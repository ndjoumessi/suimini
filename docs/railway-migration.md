# Migration Railway — plan & prérequis (Phase 1)

> État : **STAGING COMPLET** (démarrée 2026-07-11 ; canary UI complet CLOS le 2026-07-11,
> pooler PgBouncer+TLS inclus). **Infra Railway PROD provisionnée + vérifiée** (2026-07-11 :
> Postgres + PgBouncer + client-TLS, schéma vide, AUCUNE donnée, aucun lien Vercel/Supabase
> prod). Reste avant cutover : brancher Vercel prod + copier les données (§5, §7).
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
  d'accès, fail-open, hors périmètre Phase 0). **Décision CLOSE (2026-07-11) : reste
  sur Supabase** — voir §5.3 (avec le caveat cross-backend).

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
- **✅ CANARY UI COMPLET — CLOS le 2026-07-11.** Validé en conditions réelles (owner
  connecté, mode `api`) sur les previews Vercel (env preview-scoped, prod intacte),
  **y compris sur la config finale pooler PgBouncer + TLS, `pool max:10`** :
  - Lecture arbre + écriture (occupation → `POST /api/data/trees/[id]/save` 200).
  - Collaboration : commentaire (person_comments Railway), suggestions.
  - RPC : `get_tree_members` / `update_member_role` / `get_invitation` via `/api/data/rpc/*`.
  - Invitations : `inviteMember` → `POST /api/data/collaboration/members` 200 ; le membre
    invité (`invited_by` dérivé de la SESSION) atterrit dans `tree_members` Railway ET
    réapparaît via `get_tree_members` (cohérence lecture/écriture, même backend).
  - Épuisement de connexions résolu par PgBouncer (voir §6ter) — plus de « too many clients ».
- Tests : `e2e/integration/railway-store.spec.ts` (self-skip sans `RAILWAY_TEST_DATABASE_URL`)
  — couvre arbre, collaboration, RPC, inviteMember. Vert sur staging.

**Surface fonctionnelle staging : COMPLÈTE.** Reste avant cutover prod → les prérequis §5
(répliquer PgBouncer+TLS sur l'env prod, `fetchMyMemberships`, re-copie données).

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

1. **Pooler transaction-mode devant Railway (BLOQUANT).** Voir §6 / §6ter. Sans lui,
   l'épuisement de connexions (§4) se reproduit dès plusieurs utilisateurs concurrents.
   → **✅ RÉPLIQUÉ + VÉRIFIÉ sur l'env Railway PROD (2026-07-11)** : env `production`
   dupliqué depuis `staging` (Postgres + PgBouncer + client-TLS start-command + cert) ;
   schéma appliqué (**10 tables vides, AUCUNE donnée**) ; `sslmode=require` OK (cert
   `CN=pgbouncer`) ; smoke complet OK à travers le pooler prod en TLS CA-épinglé ;
   connexions saines (3/100). Prod pooled = `tokaido…:30052`, direct/unpooled = `…:59595`.
   Reste au cutover : brancher le Vercel PROD sur l'URL POOLÉE + `RAILWAY_DB_CA_CERT`.
2. **TLS durci (BLOQUANT).** En prod → **`RAILWAY_DB_CA_CERT`** (cert PgBouncer) +
   `RAILWAY_DB_TLS_SERVERNAME=pgbouncer`, **jamais** `RAILWAY_DB_INSECURE_SSL`. Déjà
   la posture de l'infra prod vérifiée ci-dessus. (Idéalement : cert PgBouncer PROPRE
   à la prod, distinct de celui de staging — rotation = §6ter.)
3. **Décision `fetchMyMemberships` — ✅ CLOSE (2026-07-11) : reste sur Supabase.**
   Raison (comme Phase 0) : liste d'accès en LECTURE (« quels arbres partagés avec
   moi »), fail-open (`error → []`), pas du contenu d'arbre.
   ⚠️ **Caveat cross-backend à connaître** : `tree_members` est ÉCRIT sur Railway (mode
   `api`+`railway`) alors que `fetchMyMemberships` LIT Supabase. Tant que le rollout est
   **owner-only** (allowlist = propriétaire), sans effet — le propriétaire voit SES
   arbres par `owner_id`, pas par appartenance. **MAIS** dès qu'on élargit à des
   invités : un membre invité côté Railway ne serait pas vu par un `fetchMyMemberships`
   qui lit Supabase (et réciproquement selon le backend de chaque user). À RÉSOUDRE
   avant tout rollout multi-utilisateur avec partage réel (migrer aussi le chemin
   membership, OU cohorter le rollout par arbre entier, OU double-écriture). Ce n'est
   PAS un blocage du canary owner-only actuel.
4. **Parité données au moment du cutover** : re-copier l'état Supabase le plus à jour
   → Railway avec vérification de comptes (source vs destination), l'agent n'ayant
   pas les creds DB Supabase (dump fourni par l'utilisateur). **À faire au cutover
   réel uniquement** (un dump anticipé serait périmé).

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

### ✅ 6ter. RÉSOLU (2026-07-11, option A) : client-TLS activé sur le PgBouncer Railway

L'image managée `ghcr.io/railwayapp-templates/pgbouncer:1` LIT bien les env
`CLIENT_TLS_SSLMODE` / `CLIENT_TLS_CERT_FILE` / `CLIENT_TLS_KEY_FILE` (mappées dans
`pgbouncer.ini` par `entrypoint.sh`), mais **ne génère PAS** de cert. On injecte
donc un cert auto-signé sans forker l'image, via une **Custom Start Command** :

**Config appliquée sur le service PgBouncer (env staging)** :
- Variables : `CLIENT_TLS_SSLMODE=require`, `CLIENT_TLS_CERT_FILE=/etc/pgbouncer/cert.pem`,
  `CLIENT_TLS_KEY_FILE=/etc/pgbouncer/key.pem`, `CLIENT_TLS_CERT_PEM=<cert>`,
  `CLIENT_TLS_KEY_PEM=<clé privée>` (chiffrées côté Railway).
- Start command (⚠️ Railway REMPLACE l'ENTRYPOINT → il faut ré-appeler `entrypoint.sh`
  pour qu'il génère `pgbouncer.ini`) :
  ```sh
  sh -c 'printf "%s" "$CLIENT_TLS_CERT_PEM" > /etc/pgbouncer/cert.pem && \
         printf "%s" "$CLIENT_TLS_KEY_PEM" > /etc/pgbouncer/key.pem && \
         chmod 600 /etc/pgbouncer/key.pem && \
         exec /entrypoint.sh /usr/bin/pgbouncer /etc/pgbouncer/pgbouncer.ini'
  ```
- Cert auto-signé : `CN=pgbouncer`, SAN `DNS:pgbouncer`.

**Côté app** (`railwayDb.ts` `sslConfig()`, inchangé) : `RAILWAY_DB_CA_CERT` = ce
cert PgBouncer + `RAILWAY_DB_TLS_SERVERNAME=pgbouncer` → **TLS vérifiée (chaîne + identité)**.
`RAILWAY_DATABASE_URL` = URL POOLÉE (`DATABASE_PUBLIC_URL` du service PgBouncer).
`pool max` remonté à 10.

**Vérifié** : `sslmode=require` OK sur l'endpoint poolé (cert `CN=pgbouncer` présenté) ;
smoke complet + `loadTrees` (teda1 71/122) OK **à travers PgBouncer en TLS CA-épinglé**,
transaction-mode compris.

**⚠️ Caveats (à garder pour le cutover)** :
- Solution par **workaround** (start command + cert en env), PAS une feature native
  managée → à re-documenter/re-tester si Railway change l'image PgBouncer.
- Rotation du cert = régénérer + mettre à jour les 2 env (`CLIENT_TLS_*_PEM`) + `RAILWAY_DB_CA_CERT`.
- Migrations/restore/psql : toujours l'URL **UNPOOLED** directe (`tokaido…:28994`),
  qui garde le cert Postgres `root-ca` (≠ cert PgBouncer).
- **Rollback** : retirer la Custom Start Command + les `CLIENT_TLS_*` du PgBouncer,
  et repointer `RAILWAY_DATABASE_URL` sur l'endpoint direct.

Le prérequis #1 (pooler+TLS) est **levé en staging ET répliqué+vérifié sur l'env
Railway PROD** (2026-07-11, cf. §5.1) — infra prod prête (schéma vide, aucune donnée).

## 7. Checklist cutover (à dérouler quand décidé — pas aujourd'hui)

- [x] PgBouncer transaction-mode + client-TLS activé (staging **et** prod). ✅ 2026-07-11
- [x] Env Railway `production` provisionné (Postgres + PgBouncer + TLS), schéma appliqué
      (tables vides). ✅ 2026-07-11
- [x] `fetchMyMemberships` tranché → reste sur Supabase (§5.3 + caveat cross-backend). ✅
- [ ] `RAILWAY_DATABASE_URL` (Vercel **prod** scope) = URL POOLÉE prod (`tokaido…:30052`) ;
      schéma/restore via l'UNPOOLED prod (`…:59595`).
- [ ] `RAILWAY_DB_CA_CERT` (prod) posé, `RAILWAY_DB_INSECURE_SSL` **absent** (déjà la
      posture staging ; idéalement un cert PgBouncer propre à la prod).
- [ ] Re-copie données Supabase→Railway PROD + vérif comptes (source vs destination) —
      **au cutover réel uniquement** (dump anticipé = périmé).
- [ ] Monter `DB_BACKEND_ALLOWLIST` progressivement (owner → %, → global) AVANT de
      basculer le défaut serveur, exactement comme le rollout DATA_LAYER (Edge Config).
- [ ] Plan de rollback : `DB_BACKEND=supabase` (flip instantané, données Supabase intactes).

**Garde-fous utilisateur** : stop + feu vert explicite avant (a) cutover prod,
(b) toute écriture/suppression sur la base Supabase de PROD.
