# Migration Railway — plan & prérequis (Phase 1)

> État : **ÉLARGISSEMENT GLOBAL 100% LIVE** (2026-07-11, feu vert explicite). **TOUS** les
> utilisateurs authentifiés de `suimini.vercel.app` lisent/écrivent le plan données depuis
> **Railway prod** (pooler PgBouncer + client-TLS, cert PROPRE à la prod). Trois leviers ouverts
> ensemble : `DB_BACKEND=railway` + **`DB_BACKEND_ALLOWLIST` retiré** (allowlist vide = tous),
> Edge Config `data_layer` = **`{"default":"api","apiPercent":100,"apiAllowlist":[]}`**, et
> **`NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1`** (`fetchMyMemberships` suit Railway). Déploiement =
> commit `67e6349` → `dpl_E9fjFVKFxWPgPVTBbsohH8VCjCmK`. Post-flip : Railway 10/100 connexions,
> 71 persons, trafic authentifié `/api/data/*` → 200, 0 erreur 500/« too many clients ».
> Données Supabase copiées + intégrité vérifiée. **Supabase = source de vérité, jamais modifié.**
> **ROLLBACK INSTANTANÉ (une ligne, network-only, sans redeploy)** : remettre l'Edge Config
> `data_layer` à `{"default":"direct","apiPercent":0,"apiAllowlist":["a8d07d13-f795-41ec-824f-5453cce02c0e"]}`
> → tous en `direct`→Supabase. (Rollback profond : `DB_BACKEND=supabase` + redeploy.)

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
2. **TLS durci — ✅ FAIT en prod.** `RAILWAY_DB_CA_CERT` + `RAILWAY_DB_TLS_SERVERNAME
   =pgbouncer`, jamais `RAILWAY_DB_INSECURE_SSL`. **Cert PgBouncer PROPRE à la prod**
   (généré 2026-07-11, distinct de staging) ; rotation zéro-downtime via bundle CA
   (l'app fait confiance à ancien+nouveau le temps du swap). Reste possible plus tard :
   restreindre le CA prod au seul cert prod (retirer le staging du bundle).
3. **Décision `fetchMyMemberships` — ✅ CLOSE (2026-07-11) : reste sur Supabase.**
   Raison (comme Phase 0) : liste d'accès en LECTURE (« quels arbres partagés avec
   moi »), fail-open (`error → []`), pas du contenu d'arbre.
   ⚠️ **Caveat cross-backend — ✅ RÉSOLU (2026-07-11) par activation du flag** : `tree_members`
   est ÉCRIT sur Railway (mode `api`+`railway`). Historiquement `fetchMyMemberships` LISAIT
   Supabase → risque, à l'élargissement, qu'un membre invité côté Railway ne soit pas vu par
   une lecture Supabase (et réciproquement). **Depuis l'élargissement global, `NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1`
   est POSÉ** → `fetchMyMemberships` lit désormais **Railway** (même backend que l'écriture) pour
   tous les users routés en `api` → lecture/écriture COHÉRENTES. Le caveat n'est plus ouvert.
   → **✅ FLAG ACTIF (2026-07-11)** : `fetchMyMemberships` a le patron `*Direct`/`*ViaApi`
   (endpoint `GET /api/data/collaboration/my-memberships` + `DataStore.getMyMemberships` +
   `RailwayStore`), gardé par **`NEXT_PUBLIC_MEMBERSHIPS_VIA_API`**. **Posé à `1` sur Vercel prod**
   (build-time, redéployé via `67e6349`) → la lecture des memberships suit `DB_BACKEND` (Railway),
   cohérente avec l'écriture. Isolé dans `sharing.ts` (ne touche pas la machinerie DATA_LAYER).
   **Rollback** : retirer le flag (repli lecture directe Supabase) — ou, plus simple, le rollback
   Edge Config `direct` remet tout le monde sur Supabase d'un coup.
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

## 7. Checklist cutover — ✅ DÉROULÉE + ÉLARGIE À 100%

- [x] PgBouncer transaction-mode + client-TLS activé (staging **et** prod). ✅ 2026-07-11
- [x] Env Railway `production` provisionné (Postgres + PgBouncer + TLS), schéma appliqué
      (tables vides). ✅ 2026-07-11
- [x] `fetchMyMemberships` tranché → reste sur Supabase (§5.3 + caveat cross-backend). ✅
- [x] **Re-copie données Supabase→Railway PROD + vérif comptes.** ✅ 2026-07-11 16:44
      Dump frais `suimini-supabase-cutover-20260711-1644.dump` → pg_restore FK-ordonné
      dans l'env prod. **Source == destination** (persons 71, relationships 122,
      tree_members 1, tree_shares 2, comments/suggestions 0, trees 1) ; 0 relation
      orpheline, 0 tombstone. Supabase = source de vérité, **non modifié** (copie).
- [x] **Vercel PROD env → pooled+TLS Railway prod.** ✅ 2026-07-11 — `RAILWAY_DATABASE_URL`
      = URL POOLÉE prod (`tokaido…:30052`), `RAILWAY_DB_CA_CERT` (cert prod propre, bundle),
      `RAILWAY_DB_TLS_SERVERNAME=pgbouncer`. Schéma/restore via l'UNPOOLED prod (`…:59595`).
- [x] **Flip `DB_BACKEND=railway`, `DB_BACKEND_ALLOWLIST=owner`.** ✅ 2026-07-11 — 12 commits
      poussés sur `origin/main` → prod déployé (git-integration). Validé par l'utilisateur
      (`suimini.vercel.app` : arbre charge + écriture OK).
- [x] **`fetchMyMemberships` activé** — `NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1` posé sur Vercel prod
      (build-time) → `fetchMyMemberships` suit Railway pour tous. ✅ 2026-07-11
- [x] **ÉLARGISSEMENT GLOBAL 100%** (feu vert explicite, risque assumé). ✅ 2026-07-11 — trois
      leviers ouverts ensemble : `DB_BACKEND_ALLOWLIST` **retiré** (tous → RailwayStore), Edge
      Config `data_layer` = `{"default":"api","apiPercent":100,"apiAllowlist":[]}` (network-only),
      `NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1`. Commit `67e6349` → `dpl_E9fjFVKFxWPgPVTBbsohH8VCjCmK`
      Ready/aliasé. Vérif : Railway 10/100 connexions, 71 persons, `/api/data/*` authentifié → 200,
      0 erreur 500/« too many clients ».
- [x] **Rollback INSTANTANÉ documenté (une ligne)** : Edge Config `data_layer` →
      `{"default":"direct","apiPercent":0,"apiAllowlist":["a8d07d13-f795-41ec-824f-5453cce02c0e"]}`
      (network-only, sans redeploy) → tous en `direct`→Supabase. Rollback profond =
      `DB_BACKEND=supabase` + redeploy (données Supabase intactes).

**Garde-fous utilisateur** : stop + feu vert explicite avant (a) cutover prod,
(b) toute écriture/suppression sur la base Supabase de PROD.

## 8. Prochaine phase — migration Auth + Storage (non commencée)

**État actuel.** La migration des **données** (arbre, collaboration, RPC, invitations) est
**complète et en prod à 100% sur Railway**, stable depuis le **2026-07-11**. **MAIS** deux
plans restent **volontairement sur Supabase**, jamais migrés, jamais prévus dans ce chantier :
- **Auth** — GoTrue / Supabase Auth (sessions, login, `profiles`, RPC admin).
- **Storage** — fichiers / photos (bucket `avatars`, uploads).

**⚠️ Conséquence à NE JAMAIS OUBLIER.** **Fermer / supprimer le compte Supabase CASSERAIT
l'authentification de l'app pour TOUS les utilisateurs, y compris le propriétaire** (plus de
login, plus de session → `/app` inaccessible), et casserait l'affichage des photos. **Supabase
reste une dépendance ACTIVE et critique**, pas un vieux backend désaffecté qu'on peut couper.
Le cutover data n'a déplacé que le **plan données d'arbre** ; l'identité et le stockage y sont
restés par conception (cf. §1 périmètre + « HORS PÉRIMÈTRE » dans `CLAUDE.md`).

**Tâche future (PAS urgente — NE PAS commencer sans décision explicite).** Si l'objectif final
est de **quitter complètement Supabase**, il faudra un **chantier séparé** pour :
- **Auth** → migrer vers Railway + une solution d'auth compatible (ex. self-host GoTrue,
  Ory/Kratos, Better Auth, Lucia…) **ou** un autre provider géré (Clerk, WorkOS, Auth0…).
  Implique la migration des comptes/sessions, des `profiles`, des RPC admin, et le remplacement
  de toute la couche `@supabase/ssr` / `useAuth` / `proxy.ts`.
- **Storage** → déplacer les fichiers (photos) vers Railway **ou** un stockage objet séparé
  (S3 / Cloudflare R2 / …), avec réécriture de `uploadImage.ts` / bucket `avatars` / RLS storage.

**Ce chantier n'a encore ni plan, ni estimation, ni feu vert.** Il est nettement plus lourd et
plus risqué que la migration data (l'auth est la primitive de session : une erreur = tout le
monde dehors).

**Prérequis avant même d'y penser** : laisser le **cutover data actuel tourner stable plusieurs
jours/semaines en conditions réelles** d'abord. Tant que ce n'est pas validé dans la durée, on
ne planifie pas la phase Auth/Storage.

> **Mise à jour (2026-07-14) — plan écrit + 1er seam posé.** Le plan concret de cette phase
> (inventaire code réel, arbitrages provider, checklists « ready », rollback par phase) vit
> désormais dans **`docs/railway-auth-storage-migration.md`**. Un **seam `StorageProvider`**
> (`src/lib/storageProvider.ts` + `mobile/lib/storageProvider.ts`, passe-plat Supabase, ZÉRO
> changement de comportement) est en place, miroir de ce que `DataStore` a fait pour les données.
> **Recommandation** : Phase A (Storage, risque faible) commençable prudemment ; **Phase B (Auth)
> à NE PAS cutover** avant plusieurs semaines de soak data (3 jours = trop court pour empiler
> l'auth).
