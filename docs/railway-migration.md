# Migration Railway — plan & prérequis (Phase 1)

> État : **EN COURS** (démarrée 2026-07-11). Staging fonctionnel, canary partiel validé.
> **NE PAS cutover en prod** tant que les prérequis bloquants ci-dessous ne sont pas levés.

## 1. Objectif & périmètre

Déplacer le **plan DONNÉES d'arbre** de Supabase vers **Railway PostgreSQL**, en
gardant l'**IDENTITÉ** (auth GoTrue, `profiles`, tenants, RPC admin, rate-limits,
push) sur Supabase. S'appuie sur la frontière Phase 0 `/api/data/*`.

- **Migré → Railway** (en mode `DB_BACKEND=railway`) : `trees`, `persons`,
  `relationships`, `journal_entries`, `tree_shares`, `tree_members`,
  `person_comments`, `person_suggestions`, `scanned_documents`, `photo_tags` ;
  + les 6 RPC data-plane (`get_tree_members`, `update_member_role`,
  `remove_member`, `my_tree_role`, `get_invitation`, `accept_invitation`) ;
  + `inviteMember` (POST `/api/data/collaboration/members`).
- **Reste sur Supabase (par conception)** : auth, `profiles`, RPC admin, et
  **`fetchMyMemberships`** (`useAuth` — « quels arbres partagés AVEC moi », lecture
  d'accès, hors périmètre Phase 0). Décision à confirmer avant cutover.

## 2. Architecture

- `DB_BACKEND` (env serveur, **jamais** `NEXT_PUBLIC`) : `supabase` (défaut =
  rollback) | `railway`. `DB_BACKEND_ALLOWLIST` = userIds (canary ciblé ; vide = tous).
- `src/lib/{railwayDb,dataStore,railwayStore}.ts`. `getDataStore(client, caller)`
  dans les routes `/api/data/*`. L'AuthZ tourne via `store.authz` → **même backend
  que les données** (sinon owner-check sur le mauvais backend = 403 à tort).
- **Pas de RLS sur Railway** : `src/lib/authz.ts` est l'unique gardien (miroir exact
  des anciennes policies).
- Schéma : `railway/schema.sql` (RLS/realtime/storage strippés, FK `auth.users` → `uuid` nu).

## 3. État staging (2026-07-11)

- Projet Railway `suimini` / env **`staging`** / **Postgres 18.4** (≠ Supabase 17.6,
  écart accepté). TEDA copié depuis le dump : **71 personnes / 122 relations / 1 tree
  (`teda1`, owner `a8d07d13-…`) / membres / share**. Dump == Railway vérifié.
- Canary preview (Vercel, env preview-scoped, prod intacte) :
  - ✅ Lecture arbre, écriture (occupation, POST `/api/data/trees/[id]/save` 200),
    commentaire (person_comments Railway), RPC (get_tree_members, update_member_role,
    get_invitation) via `/api/data/rpc/*`.
  - ✅ `inviteMember` migré derrière `/api/data/collaboration/members`.
- Tests : `e2e/integration/railway-store.spec.ts` (self-skip sans `RAILWAY_TEST_DATABASE_URL`).

## 4. Incident 2026-07-11 — épuisement de connexions (structurel)

Chargement d'arbre KO sur le preview : `FATAL: sorry, too many clients already`.
**Cause** : Railway `max_connections = 100` saturé par ~20-30 instances de fonctions
Vercel (Fluid Compute), chacune détenant un `pg.Pool` de connexions **inactives mais
non libérées** (l'instance gelée garde son pool ouvert). Sans pooler partagé, les
100 slots sont mangés. Confirmé : après libération des connexions, `loadTrees`
réussit immédiatement (données 100 % intactes).

**Mitigation livrée** (`railwayDb.ts`) : `pool max: 1` + `idleTimeoutMillis: 10s` +
`allowExitOnIdle`. ~30 instances × 1 ≪ 100. **Ne résout PAS** le problème à l'échelle
prod (Fluid Compute peut scaler bien au-delà, et `max:1` sérialise les requêtes
intra-instance).

## 5. ⚠️ PRÉREQUIS BLOQUANTS AU CUTOVER PROD

Ces points ne sont **PAS** optionnels — sans eux, la prod échouerait sous une charge
d'usage **normal multi-utilisateurs** (pas seulement sous test intensif).

1. **Pooler transaction-mode devant Railway (BLOQUANT).** Voir §6. Sans lui,
   l'épuisement de connexions (§4) se reproduira en prod dès plusieurs utilisateurs
   concurrents. La mitigation `max:1` n'est qu'un pansement pour le canary.
2. **TLS durci (BLOQUANT).** Le canary tourne avec `RAILWAY_DB_INSECURE_SSL=1`
   (staging) OU `RAILWAY_DB_CA_CERT` (CA épinglé). En prod → **`RAILWAY_DB_CA_CERT`
   uniquement** (jamais le flag insecure). Voir `railwayDb.ts` `sslConfig()`.
3. **Décision `fetchMyMemberships`** : le migrer derrière le DataStore, ou acter
   qu'il reste sur Supabase (implique que `tree_members` doit exister/être cohérent
   des DEUX côtés, ou que ce chemin lit un backend distinct — à trancher).
4. **Parité données au moment du cutover** : re-copier l'état Supabase le plus à jour
   → Railway avec vérification de comptes (source vs destination), l'agent n'ayant
   pas les creds DB Supabase (dump fourni par l'utilisateur).

## 6. Pooling Railway — option retenue : PgBouncer MANAGÉ

Railway propose PgBouncer **managé nativement** (pas de service à déployer soi-même) :

- **Activer** : service Postgres → **Database → Config → Connection Pooling → Add
  PgBouncer** → mode **Transaction** (recommandé serverless) → déployer.
- **4 variables** exposées ensuite :
  - `DATABASE_URL` — **poolé**, réseau privé (app on-Railway).
  - `DATABASE_PUBLIC_URL` — **poolé**, TCP proxy → **c'est celle que Vercel doit
    utiliser** (mettre à jour `RAILWAY_DATABASE_URL` côté Vercel avec cette valeur).
  - `DATABASE_UNPOOLED_URL` / `DATABASE_PUBLIC_UNPOOLED_URL` — **direct** (non poolé)
    → **migrations / restore / `psql` / DDL** (`railway/schema.sql`, copie de données).
- **Scaling** : 1 réplica = 20 connexions serveur / 1 000 clients ; jusqu'à 6 réplicas.
  `max_connections=100` → **1 réplica suffit largement** (20 ≪ 100).
- **Mode transaction — compat de notre app** :
  - ✅ `RailwayStore` : requêtes paramétrées `pg` **sans** `name` → **pas de prepared
    statements** → compatible. `withTransaction` (BEGIN/COMMIT) → OK (la transaction
    garde sa connexion serveur le temps du COMMIT).
  - ✅ Pas de `LISTEN/NOTIFY`, ni advisory locks, ni `SET` de session dans le data-plane.
  - ⚠️ Ne JAMAIS lancer les migrations/restore via l'URL poolée → utiliser l'URL
    **UNPOOLED**.
- **Après activation** : on peut **remonter `pool max`** dans `railwayDb.ts` (le pooler
  multiplexe) — la mitigation `max:1` redevient inutile.

### ⚠️ 6bis. BLOCAGE découvert (2026-07-11) : PgBouncer public = PLAINTEXT

PgBouncer activé sur staging, MAIS son **endpoint public** (`DATABASE_PUBLIC_URL`
via `*.proxy.rlwy.net`) **ne supporte PAS TLS** (`sslmode=require` → « server does
not support SSL » ; `sslmode=disable` fonctionne). Le proxy TCP Railway est un
passthrough brut (pas de TLS au bord) → **Vercel → PgBouncer public serait EN CLAIR
sur Internet** (PII non chiffrée). Inacceptable, même en staging.

- La config PgBouncer Railway n'expose PAS `CLIENT_TLS_SSLMODE`/certs (clés vues :
  POOL_MODE, DEFAULT_POOL_SIZE, MAX_CLIENT_CONN, AUTH_QUERY, SERVER_RESET_QUERY…).
- L'URL poolée **privée** (`pgbouncer.railway.internal`) est sûre (VPC) mais
  **injoignable depuis Vercel**.

**Conséquence** : le prérequis #1 (pooler) se dédouble → il faut un pooler
transaction-mode **ET** chiffré sur le chemin public Vercel→Railway. Options à
trancher AVANT cutover (aucune ne bloque le canary actuel, qui tourne sur l'endpoint
DIRECT en TLS CA-épinglé + `max:1`) :
- **(A)** Activer le client-TLS sur le PgBouncer Railway (`CLIENT_TLS_SSLMODE=require`
  + cert) — faisabilité à vérifier sur le template managé (peut nécessiter un cert
  auto-signé + config non exposée).
- **(B)** Réseau PRIVÉ : héberger l'app (ou une couche d'accès DB) SUR Railway →
  `pgbouncer.railway.internal` (poolé, privé, pas de TLS-sur-Internet). Gros
  changement (l'app est sur Vercel).
- **(C)** Reconsidérer la cible : un hôte offrant un **pooler serverless chiffré
  nativement** (ex. Neon : driver HTTPS + pooling TLS) — remet en question le choix
  Railway pour une app Vercel.
- **(D)** Rester sur l'endpoint DIRECT (TLS CA-épinglé) + `pool max` bas, en acceptant
  la limite de montée en charge (viable pour faible concurrence ; fragile en pic).

Le CANARY continue sur (D) tel quel — stable et chiffré. La décision pooler+TLS est
un point de cutover, pas un blocage du test d'invitation.

## 7. Checklist cutover (à dérouler quand décidé — pas aujourd'hui)

- [ ] PgBouncer transaction-mode activé (staging d'abord, re-tester le canary).
- [ ] `RAILWAY_DATABASE_URL` (prod scope) = `DATABASE_PUBLIC_URL` **poolé** ;
      schéma/restore via `DATABASE_PUBLIC_UNPOOLED_URL`.
- [ ] `RAILWAY_DB_CA_CERT` posé (prod), `RAILWAY_DB_INSECURE_SSL` **absent**.
- [ ] `railwayDb.ts` `pool max` remonté (ex. 5-10) une fois le pooler en place.
- [ ] `fetchMyMemberships` tranché.
- [ ] Re-copie données Supabase→Railway + vérif comptes (source vs destination).
- [ ] Monter `DB_BACKEND_ALLOWLIST` progressivement (owner → %, → global) AVANT de
      basculer le défaut serveur, exactement comme le rollout DATA_LAYER (Edge Config).
- [ ] Plan de rollback : `DB_BACKEND=supabase` (flip instantané, données Supabase intactes).

**Garde-fous utilisateur** : stop + feu vert explicite avant (a) cutover prod,
(b) toute écriture/suppression sur la base Supabase de PROD.
