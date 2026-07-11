# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Guide pour travailler dans **Suimini** — application **web** (Next.js) d'arbre généalogique (FR/EN), collaborative et élégante, **+ une app mobile** React Native/Expo dans `mobile/` (voir la section « Mobile »).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind 4** (présent mais peu utilisé — voir Design)
- **Supabase** (`@supabase/ssr`) pour l'auth + les données ; l'app reste **100 % fonctionnelle hors-ligne** (localStorage) si Supabase n'est pas configuré
- **next-intl** pour l'i18n (FR/EN)
- **Leaflet** / `react-leaflet` (carte), `jspdf` + `html2canvas` (export PDF), `lucide-react` (icônes)
- Déploiement **Vercel**

## ⚠️ Node : utiliser la v22

Le `node` par défaut du shell est trop ancien (v20). **Avant tout `tsc` / `build` / `dev` / Playwright :**

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

## Commandes

```bash
npm run dev          # serveur de dev
npm run build        # build prod (lance aussi le type-check Next + ESLint)
npm run start        # sert le build prod (utilisé par le job e2e en CI)
npm run lint         # ESLint seul
npx tsc --noEmit     # type-check seul
npm run test:e2e     # Playwright (e2e/, ~31 specs — voir « Tests & CI »)
npm run test:e2e:ui  # Playwright en mode UI (debug interactif)
vercel --prod --yes  # déploiement production
```

Lancer **une seule** spec (pattern pure-logic, sans serveur) :

```bash
E2E_BASE_URL=http://localhost:9999 npx playwright test e2e/sync-logic.spec.ts
```

Qualité attendue avant commit : **`tsc --noEmit` ✅ et `npm run build` ✅** (sous Node 22).

## Architecture

```
src/
  app/                 # App Router. Pages: / (landing), /app (l'app), /profil,
                       #   /arbre/[slug] (partage public lecture seule), /invite/[token],
                       #   /cgu, /confidentialite, /auth/*. API (server-only):
                       #   /api/narrative + /api/narrative-person + /api/analyze-photo +
                       #   /api/ocr-document + /api/search (Anthropic), /api/export-pdf
                       #   (HTML livret), /api/send-approval + /api/send-invite-email +
                       #   /api/send-approval-email (Resend), /api/push/register
                       #   (enregistre un Expo Push Token, auth Bearer). sitemap.ts, robots.ts.
                       #   /api/data/* = FRONTIÈRE DONNÉES Phase 0 (trees, rpc,
                       #   collaboration, whoami) — voir « Couche d'accès données ».
                       #   /api/data-layer = défaut serveur runtime du transport
                       #   (Edge Config, network-only) — voir « Flip global ».
                       #   /admin/health = statut migrations/env + défaut transport.
    layout.tsx         # <html lang>, polices next/font, NextIntlClientProvider, preconnects
    globals.css        # SYSTÈME DE DESIGN "Atelier" (variables CSS + classes utilitaires)
  proxy.ts             # Garde d'auth Next 16 (PAS middleware.ts) — protège /app
  components/          # ~40 composants. SuiminiApp.tsx orchestre l'app connectée
                       #   (Sidebar desktop, BottomNav mobile, PrintModal, ExportPDFModal…).
    landing/Landing.tsx
  hooks/               # useAuth, useFamilyStore, useAdminData, useTheme, useDarkMode, useMediaQuery…
  lib/                 # supabase.ts, supabaseSync.ts, treeUtils.ts, sampleData.ts,
                       #   emails.ts, sharing.ts, pdfTemplates.ts…
                       #   Phase 0 couche données : dataClient.ts (frontière réseau +
                       #   flag cookie + défaut serveur), dataLayerConfig.ts (règle
                       #   Edge Config + bucketing rollout), authz.ts, apiAuth.ts,
                       #   apiData.ts, rpcClient.ts, collaboration.ts (commentaires/suggestions).
  i18n/                # config.ts (constantes) + request.ts (locale SSR depuis cookie)
                       #   + messages.ts (bundle fr+en → bascule instantanée via IntlProvider)
messages/              # fr.json + en.json
supabase/              # schema.sql + scripts *.sql (share-public.sql, storage.sql,
                       #   push-tokens.sql…) ; migrations/ = framework VERSIONNÉ
                       #   (0001-0017 + scripts/migrate.mjs) — voir « Migrations ».
  teda/                # scripts SQL de l'arbre famille TEDA (seed, enrichissement,
                       #   update-teda-v2-final.sql…) ; pdf/ = sources du PDF de synthèse
mobile/                # App React Native / Expo (SDK 54) — voir section « Mobile »
e2e/                   # tests Playwright
docs/                  # notes de conception (détails sortis de CLAUDE.md) :
                       #   phase0-data-api-design.md (design frontière /api/data),
                       #   phase0-mobile-track.md (piste mobile Phase 0),
                       #   sync-internals.md (internes sync/conflits — voir « Synchronisation »),
                       #   handoff-2026-07-10.md (état de reprise Phase 0),
                       #   railway-migration.md (migration DONNÉES → Railway, PLAN + état —
                       #     voir « Backend données — Railway »)
```

> ⚠️ Le **root `tsconfig.json` exclut `mobile`** (`exclude: ["node_modules","mobile"]`) : le projet RN a son propre `tsconfig`/`node_modules`. Sans ça, `tsc`/`next build` au root planteraient sur les fichiers `mobile/`.

### Auth & multitenant
- `src/proxy.ts` (convention **`proxy`** de Next 16, le `middleware` est déprécié) protège `/app` : nécessite une session Supabase **ou** le cookie démo, et un statut `approved` (sinon redirige vers `/`).
- `useAuth` (`src/hooks/useAuth.ts`) expose `user`, `isDemo`, `signIn`, `signUp`, `startDemo`, etc.
- Statuts de compte : `pending | approved | rejected | suspended` ; rôles : `user | admin | superadmin`.

### Données (arbres)
- `useFamilyStore` : source de vérité. Persiste en **localStorage** et synchronise avec **Supabase** quand connecté. Seede toujours l'arbre d'exemple **« Famille Dupont » (`tree1`)** pour les invités/démo.
- `lib/supabaseSync.ts` : mappage lignes ↔ objets, chargement/sauvegarde, partage (`shareTree`, `setTreePublic`, `loadPublicTree`).
- Schéma SQL dans `supabase/schema.sql`. **Deux voies pour les migrations** : (a) framework **versionné** `supabase/migrations/NNNN_*.sql` + `scripts/migrate.mjs` (runner psql local / Management API CI via `SUPABASE_ACCESS_TOKEN`) — voir « Migrations » ; (b) manuel dans le SQL Editor (toujours valable, ex. `supabase/share-public.sql`).
- Arbre **famille TEDA** (`teda1`) : scripts SQL dans `supabase/teda/`. **État de référence = 57 personnes / 93 relations**, restauré depuis l'export applicatif via **`RESTORE_TEDA_FROM_EXPORT.sql`** (source de vérité ; max `teda-p58` / `teda-r94`). `update-teda-djoumessi-family.sql` ajoute la famille de DJOUMESSI Mathias (→ 71/119). ⚠️ **Convention de noms TEDA** : `first_name` = **NOM de famille**, `last_name` = **prénom** (ex. `('DJOUMESSI','Mathias')`, `('TSANA','Sébastien')`). Le **PDF de synthèse** est généré depuis `supabase/teda/pdf/teda_v2.html` (HTML « Atelier » autonome) via `render.mjs` (rendu Chromium/Playwright, Node 22) — voir `supabase/teda/pdf/README.md`.

### Couche d'accès données (Phase 0 — DataClient / frontière API)
Objectif : router **tout l'accès aux DONNÉES D'ARBRE** du navigateur via `/api/data/*` (backend interchangeable, AuthZ applicative en plus de la RLS), **sans jamais casser le mode direct** (rollback instantané). Voir `docs/phase0-data-api-design.md` + `docs/handoff-2026-07-10.md`.
- **Frontière unique `getDataClient()`** (`lib/dataClient.ts`) : le store (`useFamilyStore`) et `collaboration.ts` ne parlent PLUS à `supabase.from(...)` en direct — ils passent par un `DataClient`. Deux transports : **`SupabaseDataClient`** (direct, défaut = **rollback**) et **`ApiDataClient`** (navigateur → `/api/data/*` → Supabase, lecture ET écriture). ⚠️ En mode `api`, `loadTrees` fait **un seul** `GET /api/data/trees` → le serveur lit persons/relationships/journal (pas de `/api/data/persons`).
- **Flag RUNTIME** `getDataLayer()` (synchrone, lu à CHAQUE appel), priorité : **cookie `suimini_data_layer`** = `api` → api / = `direct` → direct (**override TOTAL bidirectionnel par session**) → sinon **DÉFAUT SERVEUR RUNTIME**. ⚠️ **PAS un `NEXT_PUBLIC_*`** (inliné au build = cause de l'échec du 1er flip). Sonde `window.__suiminiDataLayer()` (⚠️ vit dans le chunk **lazy** de `SuiminiApp` → tester **sur `/app`, app montée**, pas sur la landing). ⚠️ Bumper le **SW** (`suimini-static-vN`) sinon l'ancien bundle est servi.
- **Flip global — défaut serveur runtime (Edge Config)** : `dataLayerConfig.ts` lit la clé **`data_layer`** de **Vercel Edge Config** (`{ default:'api'|'direct', apiPercent:0..100, apiAllowlist:[userId] }`), résolue **par appelant** dans **`GET /api/data-layer`** (`getServerAuth`) — **anonyme → toujours `direct`** (`if(!caller) return 'direct'` AVANT toute lecture Edge Config → protège `/invite` pré-login). Le navigateur résout le défaut **une fois au boot** via `ensureServerDataLayer()` (fetch `/api/data-layer`, **network-only** → non caché par le SW → flip/rollback **instantanés sans redeploy**), mémoïsé dans `serverDefaultLayer` (fail-safe `direct`). Rollout **sticky** par `bucketOf(userId)` (FNV-1a déterministe → `{bucket<apiPercent}` monotone, pas de clignotement entre paliers). **Écrire la clé via CLI** : `vercel edge-config update <ecfg_id> --patch '{"items":[{"operation":"upsert","key":"data_layer","value":{...}}]}'` (le dashboard peut ne pas persister ; ⚠️ éditer LE store connecté au projet = celui pointé par l'env var `EDGE_CONFIG`). Sonde admin : `/admin/health` (edgeConfigured/default/apiPercent/allowlist). **État (2026-07-11) : ÉLARGI À 100% — `data_layer` = `{default:'api', apiPercent:100, apiAllowlist:[]}` → tous les users authentifiés routent en `api`.**
- **Endpoints arbre concrets** : `GET /api/data/trees` (liste + contenu), `GET|…/api/data/trees/[id]`, `POST /api/data/trees/[id]/save` (upsert arbre), `/children/delete` (soft-delete), `/restore`, `/conflicts` (détection delete-vs-edit), `/api/data/whoami`. Collaboration + `rpc/[name]` idem.
- **Serveur** (`app/api/data/*`) : `getServerAuth()` (`lib/apiAuth.ts`) résout l'appelant par **cookie de session** OU **`Authorization: Bearer`** (mobile) ; les requêtes tournent **sous l'identité de l'appelant** → RLS en filet. AuthZ applicative miroir des RLS dans **`lib/authz.ts`** (prédicats `canReadTreeAsMember`/`canWriteTreeContent`/`isTreeOwner`…) + helper **`apiData.guardTreeWrite(treeId,'write'|'owner')`**. RPC forwardées via **`callRpc`** (`lib/rpcClient.ts`) → `/api/data/rpc/[name]` (whitelist 16 RPC).
- **`collaboration.ts`** (commentaires/suggestions) suit le même patron : cœurs **`*Direct(client)`** injectables (navigateur direct + routes serveur) + **`*ViaApi()`** (fetch), endpoints **`/api/data/collaboration/{comments,suggestions,suggestions/count,suggestions/resolve}`**. AuthZ **owner-only** (miroir exact du RLS `0012`). Realtime/presence (WebSocket) restent directs. Les composants appelants (`PersonPanel`, `Sidebar`) sont **inchangés** (signatures rétro-compatibles).
- **HORS PÉRIMÈTRE (directs Supabase même en mode `api`, par conception)** : GoTrue `/auth/v1/*` (primitive de session), `profiles` (identité self), **`tree_members` via `fetchMyMemberships` (`useAuth`)** = « quels arbres partagés avec moi » (accès, pas contenu ; fail-open `error → []`), et le **WebSocket realtime**. Ne PAS les confondre avec le trou de contenu (collaboration, désormais migré). Canary **lecture+écriture arbre validé**, **collaboration validée EN AUTHENTIFIÉ** (2026-07-10, les 6 fonctions via `/api/data/collaboration/*`, 0 fuite REST), **RPC validées** (get_tree_members/update_member_role/get_invitation via `/api/data/rpc/*`). **Flip global élargi à 100%** (2026-07-11, défaut serveur Edge Config `apiPercent:100`) — tous les users authentifiés en `api`. Tests : `e2e/{data-client,data-layer-config,authz,rpc-client,collaboration-client}.spec.ts`.
- **RLS résiliente (`0017`)** : les policies `*_members_read` ne peuvent plus faire **500-er la lecture du propriétaire** pendant une panne `tree_members` (test propriétaire = disjoint de premier niveau **sans** `tree_members` + fonction **`is_accepted_member()`** `SECURITY DEFINER` avec `EXCEPTION → false` = fail-closed). `supabase/sharing.sql` porte la version résiliente (le restore post-incident la ramène). Côté UI, **`SyncFailedState`** distingue « chargement échoué → Réessayer » de « vraiment aucun arbre » (plus jamais l'onboarding sur une erreur réseau).

### Backend données — Railway (Phase 1) — LIVE GLOBAL 100% (tous les users)
> **Plan complet + état + rollback + checklist → `docs/railway-migration.md`.** Ci-dessous, invariants load-bearing seulement.

Déplacer le **plan DONNÉES d'arbre** de Supabase vers **Railway Postgres**, en gardant l'**IDENTITÉ** (auth GoTrue, `profiles`, RPC admin, rate-limits, push) sur Supabase. Étage **serveur** sous la frontière `/api/data/*` de Phase 0 (là où Phase 0 choisit le TRANSPORT navigateur `getDataClient`, Phase 1 choisit le BACKEND serveur `getDataStore`).
- **Frontière `getDataStore(client, caller)`** (`lib/dataStore.ts`) : les routes `/api/data/*` ne lisent/écrivent plus via le client Supabase en direct → elles passent par un **`DataStore`**. Deux impls : **`SupabaseStore`** (passe-plat fidèle vers `supabaseSync`/`collaboration`/`sharing` = **défaut/ROLLBACK**) et **`RailwayStore`** (`lib/railwayStore.ts`, SQL brut `pg`, réutilise les mappers PURS de `supabaseSync` — importés/exportés). ⚠️ L'AuthZ tourne via **`store.authz`** → **MÊME backend que les données** (sinon owner-check sur le mauvais backend = 403 à tort). `guardTreeWrite/guardTreeRead` (`apiData.ts`) résolvent le store.
- **Flag SERVEUR `DB_BACKEND`** (env, **jamais `NEXT_PUBLIC`**) : absent/`supabase` → SupabaseStore ; `railway` → RailwayStore **uniquement si l'appelant ∈ `DB_BACKEND_ALLOWLIST`** (canary ciblé ; vide = tous). Distinct du flag TRANSPORT `getDataLayer` (cookie/Edge Config, Phase 0) : les DEUX doivent s'aligner (navigateur `api` **+** serveur `railway` allowlisté) pour qu'un user tape Railway. **Rollback instantané = `DB_BACKEND=supabase` + redeploy** (données Supabase intactes, jamais modifiées — la migration est une COPIE).
- **`lib/railwayDb.ts`** : pool `pg` server-only (`RAILWAY_DATABASE_URL`). **TLS** via `sslConfig()` : `RAILWAY_DB_CA_CERT` (CA épinglé, chaîne + identité vérifiées, `RAILWAY_DB_TLS_SERVERNAME` défaut `localhost`) ; `RAILWAY_DB_INSECURE_SSL=1` = repli staging non authentifié ; parser timestamptz→ISO (contrat de type des mappers). `pool max:10` (derrière PgBouncer).
- **Pooler OBLIGATOIRE (serverless)** : Vercel = un `pg.Pool` PAR instance → sature `max_connections` sans pooler (« too many clients already »). **PgBouncer managé Railway** (transaction-mode) devant. ⚠️ Le PgBouncer public Railway est **plaintext par défaut** → on active le **client-TLS** via un **cert auto-signé injecté** (Custom Start Command qui écrit le cert depuis un env `CLIENT_TLS_*_PEM` puis ré-appelle `entrypoint.sh` — Railway REMPLACE l'ENTRYPOINT). `RAILWAY_DATABASE_URL` = URL **POOLÉE** ; **migrations/`psql`/DDL = URL UNPOOLED directe**. Cert PgBouncer **distinct staging/prod**.
- **Schéma** : `railway/schema.sql` (10 tables data-plane, **PAS de RLS/realtime/storage**, FK `auth.users` → `uuid` nu). Postgres 18 (staging/prod).
- **Migration données** : l'agent n'a **PAS** les creds DB Supabase → l'utilisateur fait le `pg_dump`, l'agent `pg_restore` (FK-ordonné) dans Railway + vérif comptes source==destination. TEDA = 71 pers/122 rel.
- **`fetchMyMemberships` — ACTIF** : `sharing.ts` a le patron `*Direct`/`*ViaApi` + endpoint `GET /api/data/collaboration/my-memberships` + `DataStore.getMyMemberships`, gardé par **`NEXT_PUBLIC_MEMBERSHIPS_VIA_API`**. **Posé à `1` sur Vercel prod** → `fetchMyMemberships` lit désormais **Railway** (même backend que l'écriture `tree_members`) pour tous les users routés en `api` → lecture/écriture cohérentes (le caveat cross-backend est clos). Repli = retirer le flag (lecture directe Supabase).
- **État (2026-07-11)** : **LIVE GLOBAL 100%** (`suimini.vercel.app`, `DB_BACKEND=railway` + **`DB_BACKEND_ALLOWLIST` retiré** = tous les appelants → RailwayStore, pooled+TLS) — feu vert explicite du user, risque assumé. Edge Config `data_layer` = `{default:'api', apiPercent:100, apiAllowlist:[]}` ; `NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1`. Déploiement `67e6349` → `dpl_E9fjFVKFxWPgPVTBbsohH8VCjCmK`. Post-flip : Railway 10/100 connexions, 71 persons, `/api/data/*` authentifié → 200, 0 erreur 500/« too many clients ». **Rollback INSTANTANÉ (une ligne, network-only, sans redeploy)** : Edge Config `data_layer` → `{default:'direct', apiPercent:0, apiAllowlist:['a8d07d13-…owner']}` = tous en `direct`→Supabase (rollback profond = `DB_BACKEND=supabase` + redeploy). Tests : `e2e/integration/railway-store.spec.ts` (self-skip sans `RAILWAY_TEST_DATABASE_URL`).

### Migrations SQL (framework versionné + SQL Editor)
- **Framework versionné** (`supabase/migrations/NNNN_*.sql`, table `suimini_migrations`, runner `scripts/migrate.mjs`) : `0001` tracking · `0002` locale · **`0003-0016`** = portage idempotent de tous les anciens scripts `supabase/*.sql` (schema, soft-delete, rate-limits, storage, push, share-public, sharing, collaboration, documents, photo-tags, birthday-cron) · **`0017`** = RLS résiliente (voir « Couche d'accès données »). Commande **`baseline`** (workflow_dispatch) = adopter `0003-0017` en prod **sans rejeu** (elles y sont déjà). En local : psql ; en CI : Management API (secrets `SUPABASE_ACCESS_TOKEN`/`_PROJECT_ID`). Workflows `.github/workflows/migrate.yml` + `deploy-edge-functions.yml` (déploiement Edge Functions en CI). **Ajouter une nouvelle migration = créer `NNNN_*.sql`** (idempotent, pas de `BEGIN/COMMIT`, le runner enveloppe).
- **Sans `service_role`** (voir « Variables d'environnement ») : l'agent ne peut PAS écrire en prod → livrer la migration + lancer `baseline`/`migrate` (utilisateur) ou coller dans le SQL Editor. `/admin/health` expose l'état des migrations/env.
- Fichiers `supabase/*.sql` (sources d'origine, idempotents ; miroir des migrations) :
- **`schema.sql`** (base) · **`soft-delete.sql`** (colonnes `deleted_at` + `purge_tombstones()`) · **`rate-limits.sql`** (RPC `consume_rate_limit`) · **`add-locale-to-profiles.sql`** (`profiles.locale` pour notif bilingues) · **`share-public.sql`** / **`sharing*.sql`** / **`collaboration*.sql`** (partage public + membres + RPC) · **`push-tokens.sql`** (Expo tokens) · **`storage.sql`** (bucket `avatars` + RLS).
- **Push anniversaires** : Edge Function `functions/send-birthday-notifications/` (déploiement `supabase functions deploy … --no-verify-jwt` + secret `CRON_SECRET`) + **`birthday-cron.sql`** (pg_cron 8h UTC).
- **TEDA** : `teda/RESTORE_TEDA_FROM_EXPORT.sql` (restauration 57/93, source de vérité) + `teda/update-teda-*.sql` (enrichissements/corrections).
- ⚠️ Valider un script contre un **Postgres jetable local** (`initdb`/`pg_ctl`) avant livraison — cf. « Pièges connus ».

### Synchronisation Supabase (`supabaseSync.ts` + `useFamilyStore`)
> **Détails internes → `docs/sync-internals.md`** (mappage `extra`↔colonnes, `pushTreeNow`, suppressions durables, écho realtime, règles de chargement, `buildGenerationMap`, résolution de conflits). Résumé des invariants à ne pas casser :
- **Architecture UPSERT-only + soft-delete** (`supabase/soft-delete.sql`) : la sync **n'émet JAMAIS de DELETE** sur les tables enfants (push = `pushChildTable` upsert pur ; suppression = `deleteChildRows` UPDATE `deleted_at`). L'ancien `syncChildTable` (DELETE-par-diff, cause de l'incident TEDA) **n'existe plus**. Seul DELETE dur restant = suppression d'un **arbre** entier.
- **Colonnes priment sur `extra`** : `rowToPerson`/`rowToRel` étalent `extra` EN PREMIER puis les colonnes canoniques (`id`, `updated_at`, `birth_place`…) — un `extra` pollué ne doit jamais écraser la vraie valeur. ⚠️ Un script SQL met chaque champ dans SA colonne (lieu → `birth_place jsonb`, PAS `extra`).
- **Chargement = hard-replace** (le distant remplace le cache local), sauf F5 même-session < 30 s (`mergeTreeFavoringLocal`). **Login/session fraîche = toujours hard-replace** (flag `suimini_session_loaded`).
- **Non-régression** : `e2e/sync-logic.spec.ts` + `realtime-echo.spec.ts` (logique pure, faux client). Helpers purs dans `src/lib/syncMerge.ts` / `src/lib/realtimeEcho.ts`.

### Export PDF (« Livret de famille ») & responsive mobile
- **Deux chemins PDF, tous deux côté navigateur** (⚠️ Playwright/Chromium ne tourne PAS dans une route API Vercel) :
  - `PrintModal.tsx` : impression livret/list/cards/summary via `window.open` + `print()`, et export *image* de l'arbre via `jspdf` + `html2canvas`.
  - **Visual tree** (export image de l'arbre) : layout générique dans `lib/treeLayout.ts` (`buildTreeLayout` — place **toute** personne une fois, bande « unattached » pour les isolés, pivot = `rootPersonId` sinon fondateur le plus prolifique). Le **« spine » (lignée principale)** = chaîne d'ancêtres du pivot (via 1er parent) + descente vers le descendant le **plus profond / récent** (enfant menant à la génération la plus basse, départage par nb de descendants — **pas** « le plus de descendants » seul, qui dévie vers une branche large mais courte). Ses connecteurs sont taggés `parent-main`, rendus **en dernier** (au-dessus des gris) en **ambre `#C9A84C` 2px**. ⚠️ **Pas d'espace blanc** : la `bbox` (`maxY`) part du **bas du dernier nœud** (pas de `y` qui a déjà avancé d'un `V_GAP`), et l'export PDF crée une **page à la hauteur du contenu** (`format: [420, singlePageH]`) au lieu d'A3 figé — pagination A3 seulement si trop haut (`> 297mm`) ou trop large (`scale < 0,4`). `validateVisualTree(tree)` = garde-fou dev (renderedNodes == totalPersons).
  - `ExportPDFModal.tsx` + `lib/pdfTemplates.ts` (`generateFamilyBookHTML`) : livret officiel (couverture, sommaire, fiches par génération, index A-Z), 3 thèmes × 3 formats (A4/A5/Letter), ouvert dans une fenêtre d'impression. `/api/export-pdf` renvoie le même HTML (endpoint secondaire). Styles **inline + hex littéraux** (la fenêtre d'impression n'a ni nos classes ni nos `var()`).
- **Mobile** : `useMediaQuery` / `useIsMobile` (≤767px). En dessous, la sidebar est masquée au profit de `BottomNav.tsx`, et `PersonPanel` s'ouvre en bottom-sheet plein écran.

### Résolution de conflits multi-appareils (`conflictQueue.ts` + sync)
> **Détails → `docs/sync-internals.md`.** En bref : **delete-vs-edit** = `detectDeleteConflicts` exclut de l'upsert une entité supprimée ailleurs après notre édition (pas de résurrection) → file `conflictQueue.ts` → `ConflictModal` (Garder la suppression / Restaurer), **fail-open**, jamais en démo. **edit-vs-edit** = `mergeTreeFavoringLocal` fait du **last-write-wins par `updatedAt`** (personnes+journal ; relations sans `updatedAt` → garde le local).

### Recherche floue & normalisation bamiléké (`bamilekeNames.ts` + `fuzzySearch.ts`)
- `bamilekeNames.ts` : `normalizeBamilekeName` (MAJ, apostrophes `TEDA'A→TEDAA`, diacritiques, « C » prothétique `CFOTIE→FOTIE` mais **pas** `CLAIRE`/`CHRISTINE`), `TEDA_SYNONYMS`, `expandSynonyms` (renvoie brutes ET normalisées), `canonicalize` (`SANA→TSANA`). `fuzzySearch.ts` : `searchPersons` (Fuse, exact/synonyme d'abord puis approché ; **les synonymes matchent par ÉGALITÉ, jamais par préfixe** — sinon `TSAN` classerait `TSANO` en exact à tort). `CommandPalette` : groupe **« Résultats approchés »** avec badge + score ; la tolérance aux fautes de NOM passe par `searchPersons` (l'ancien `fuzzyMatch` sous-séquence n'est plus dans le bucket exact, sinon il masquait le badge « approché »). OCR (`ocrNormalization.ts`) réutilise `canonicalize`.

### Détection de doublons (`duplicateDetection.ts` web + mobile)
- `findPotentialDuplicates(newPerson, existing)` : score par champ (prénom 40, nom 30, année ±2 20, genre 10), seuil ≥60, `isBlocking` ≥90. Web : intégré dans **`AddPersonModal`** (PAS PersonForm — il n'a pas accès à la liste ; edit via PersonPanel non affecté) ; `DuplicateWarningModal` mode warn `[Annuler][Ajouter quand même]` / mode bloquant `[Annuler][Ouvrir la fiche existante]` (→ `onOpenPerson` → `handleSelectPerson`). Mobile : `edit.tsx`, `Alert` natif gardé sur `!isEdit`. `normalizeName` **auto-contenu** (ne dépend pas de bamilekeNames).

### Compression photo, OCR camerounais, tests d'intégration
- **Compression** (`imageCompression.ts` web+mobile) : au point de choke `uploadAvatar` (`uploadImage.ts`) → **tous les appelants** en profitent ; webp, max 800px, skip si <200 Ko ou déjà webp, jamais d'agrandissement. `UploadResult` porte `beforeBytes/afterBytes` (affiché dans GalleryView). Mobile : flux d'upload photo désormais **câblé** (voir « Photo mobile » dans la section Polish).
- **OCR camerounais** : `ocr-document/route.ts` (prompt bamiléké spécialisé + schéma `type/persons[role,gender,birthPlace]/relations/acteNumber/commune/confidence`), post-traité par `ocrNormalization.ts` (variantes → canonique via `canonicalize`, `lastName` remplacé **seulement si variante**). `DocumentScanner` : badge de confiance + correction avant import. `enforceRateLimit` conservé.
- **Tests d'intégration cloud** : `e2e/integration/supabase-sync.spec.ts` (vrai client Supabase, **self-skip** sans `SUPABASE_TEST_*` → suite normale verte) ; workflow `integration-tests.yml` ; procédure `supabase/test-project.md`. Créer un projet Supabase de test + 3 secrets GitHub (manuel).

### Statut Supabase, export GEDCOM, récits focalisés
- **Statut Supabase temps réel** : `useSupabaseStatus` (web `src/hooks/`, mobile `mobile/hooks/`) sonde `status.supabase.com/api/v2/*.json` (60 s, cache sessionStorage 55 s, **fail-open** → jamais de blocage de rendu). `StatusBanner` (web + mobile) s'affiche **seulement si indicator ≠ 'none'** (minor=ambre, major=orange, critical=rouge+`role=alert`), fermable par incident (sessionStorage `suimini_status_dismissed_{id}`). Page **`/status`** (`src/app/status/`, **publique** — hors matcher du proxy) : incidents en cours + composants (Database/Auth/Storage/Realtime/Edge Functions) + résolus 30 j ; lien depuis Settings (`settings.linkStatus`). CORS statuspage.io permissif → fetch client OK. i18n `status.*` (+ `status.comp.*`).
- **Export GEDCOM** : `exportGEDCOM` (`treeUtils.ts`, déjà câblé dans `ImportExportModal`) — 5.5.1, enrichi `NICK` (nickName), `NOTE` (bio, continuations `CONT`/`CONC` ≤248), **CRLF**, HEAD complet, sanitisation des valeurs mono-ligne. ⚠️ Ordre `firstName /lastName/` **conservé** (la convention TEDA nom-dans-firstName est un choix de saisie par arbre, pas une règle d'export — l'inverser corromprait les arbres non-TEDA). Round-trip validé via `parseGEDCOM` (NICK non relu à l'import = perte connue, exporté pour les logiciels tiers).
- **Récits IA focalisés** : `/api/narrative` accepte `{ mode:'full'|'generation'|'branch', generation?, rootPersonId?, locale }` (défaut `full` = inchangé ; portrait = `/api/narrative-person` existant). `narrativeContext.ts` (pur) construit les membres par génération (`buildGenerationMap`) ou branche (descendants BFS via `getChildren`) + contexte historique camerounais par ère. `NarrativeModal` : dropdown de mode + sélecteur génération + picker de personne (branche). Cache localStorage `suimini_narrative_{treeId}_{mode}_{key}` (TTL 24 h, invalidé par signature `count:maxUpdatedAt`). Rate-limit `/api/narrative` relevé **3→10/h**.

### Polish : PWA update, impression, notifications, photo mobile
- **Mise à jour PWA contrôlée** : `public/sw.js` ne fait **plus** `skipWaiting()` au `install` (un nouveau SW ATTEND au lieu de prendre le contrôle en silence — cause du « bloqué sur ancienne version ») ; il écoute `message` `SKIP_WAITING`. `useServiceWorkerUpdate` (poll 60 s, `updatefound`/`statechange`) → `UpdateBanner` (inline ambre, `role=status`) propose « Actualiser » → `postMessage(SKIP_WAITING)` + reload sur `controllerchange`. ⚠️ Bumper le nom de cache (`suimini-static-vN`) à chaque changement de SW. Caveat bootstrap : le 1er déploiement de cette logique ne prévient pas les users encore sur l'ancien SW ; tous les suivants oui. i18n `pwa.*`.
- **Aperçu impression clair/sombre** (`PrintModal`) : toggle `[Aperçu sombre|Aperçu clair]` (aria-pressed) qui thème **uniquement le « well » d'aperçu** (`.print-preview-light|dark` dans globals.css) — la sortie imprimée (`window.open`) reste **byte-identique** (hex littéraux). Persisté `suimini_print_preview_mode`. Helpers purs `nextPreviewMode`/`previewClass`. i18n `printModal.preview*`.
- **Notifications push bilingues** : la Edge Function localise **par destinataire** via `profiles.locale` (Map userId→locale, défaut `fr`, **fail-safe** si la colonne manque). Migration manuelle **`supabase/add-locale-to-profiles.sql`** (`locale text default 'fr' check in (fr,en)` ; pas de policy — `profiles_modify` self-update suffit, non bloqué par le trigger privilégié). Settings web : sélecteur « Langue des notifications » (indépendant de la locale UI, masqué avant migration). Redéploiement manuel : `supabase functions deploy send-birthday-notifications --no-verify-jwt`.
- **GEDCOM round-trip NICK** : `gedcomParser` lit désormais `2 NICK` → `Person.nickName` (l'export l'émettait déjà) ; round-trip surnom fermé.
- **Photo mobile** : flux complet (`mobile/lib/uploadImage.ts` `uploadAvatarMobile` + `PhotoPickerSheet`) — pick/caméra (`expo-image-picker`) → `compressImageAsync` (webp ≤800px) → Storage bucket **`avatars`** chemin **`${user.id}/…`** (⚠️ userId en 1er segment = RLS, jamais treeId, miroir du web) → `upsertPerson`. Démo → uri locale sans upload. Permissions via plugin `expo-image-picker` dans `app.json`. i18n mobile `photo.*`.

### Rate limiting IA & notifications push (server)
- **Rate limiting** des 5 routes Anthropic (`narrative` 3/h, `narrative-person` 10/h, `analyze-photo` 5/h, `ocr-document` 5/h, `search` 20/h) : `src/lib/rateLimit.ts` (`enforceRateLimit` en tête de chaque POST) → RPC SECURITY DEFINER `consume_rate_limit` (migration **`supabase/rate-limits.sql`**, table `api_rate_limits` sans policy directe). Anonyme/démo = repli mémoire par IP. **Fail-open** si la RPC n'existe pas (pré-migration). 429 = `{ error: message localisé (cookie NEXT_LOCALE), code: 'rate_limit_exceeded', retryAfter }` — les UI affichent `data.error` telles quelles.
- **Push anniversaires/commémorations** : Edge Function `supabase/functions/send-birthday-notifications/` (Deno — **exclue du tsc racine** via `tsconfig exclude: supabase/functions`), déclenchée par pg_cron (**`supabase/birthday-cron.sql`**, 8h UTC, header `Bearer CRON_SECRET`). Dates TEXT → filtrage mois-jour en JS ; message avec le **nom complet** (convention TEDA prénom/nom inversés) ; destinataires = owner + `tree_members` acceptés → `push_tokens` ; tokens `DeviceNotRegistered` purgés (hors règle soft-delete). Déploiement manuel : `supabase functions deploy` + `secrets set CRON_SECRET`.
- **Backup quotidien** : `.github/workflows/backup-db.yml` (2h UTC + manuel) — export JSON de toutes les tables (tombstones incluses) via la Management API, artifact 30 j. Secrets requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` (optionnels : `RESEND_API_KEY`, `BACKUP_ALERT_EMAIL`).

### Emails (Resend, server-only)
- Contenu HTML dans `lib/emails.ts` (Atelier, table-based, hex littéraux, fallback Georgia). Routes : `/api/send-approval` (compte activé), `/api/send-invite-email` (invitation membre), `/api/send-approval-email` (notifie le **propriétaire** quand un membre accepte — hook *best-effort* dans `acceptInvitation` de `lib/sharing.ts`, couvre les deux chemins d'acceptation : bouton explicite ET auto-accept post-login).
- ⚠️ **RLS** : un user ne lit que **son** profil (`profiles_select using (id = auth.uid())`). Pour lire l'email/`display_name` d'un pair (ex. le propriétaire), passer par la RPC SECURITY DEFINER **`get_public_profiles(ids uuid[])`** — jamais un `select` direct sur `profiles`. NB : `profiles` a `display_name` (pas `first_name`/`last_name`).
- Toutes les routes email **no-op gracieusement** (`200 { skipped }`) sans `RESEND_API_KEY`.

### i18n (next-intl, sans routing URL)
- Mode **"without i18n routing"** : la locale vient du **cookie `NEXT_LOCALE`** (défaut `fr`), **pas de l'URL** (pas de `/en`). `app/` n'est PAS restructuré.
- **Bascule instantanée, sans reload** : `src/components/IntlProvider.tsx` garde la locale en **state React** et bundle les **deux** jeux de messages (`src/i18n/messages.ts` → `MESSAGES = {fr,en}`). `useLocaleSwitch().setLocale()` re-rend tous les `useTranslations` **en place** (aucune navigation) et écrit cookie + localStorage + `<html lang>` en arrière-plan. `LanguageSwitcher.tsx` l'utilise (web ; pas de `window.location.reload`).
- SSR / premier paint : `src/i18n/request.ts` + `layout.tsx` (`getLocale()`) seedent `IntlProvider initialLocale` depuis le cookie. Lire le cookie rend `/` **dynamique** (`ƒ`) — voulu.
- Chaînes dans `messages/{fr,en}.json` ; `useTranslations('namespace')`. **Parité fr/en obligatoire** (mêmes clés des deux côtés — vérifier avant commit).
- ⚠️ **Piège ICU** : une **apostrophe d'élision juste avant un tag** rich (`d'<b>…`) casse le parseur ICU de next-intl (le `'` ouvre une citation littérale → le markup s'affiche en clair). Mettre l'apostrophe **dans** le tag : `<b>droit d'accès</b>`, `<b>L'export…</b>`. (Vérifiable avec `intl-messageformat`.)
- ⚠️ « L'app affiche EN alors que FR semble sélectionné » n'est **pas un bug** : le cookie `NEXT_LOCALE` est à `en` ; toute l'app suit la locale de session.

## Design — système « Atelier » (thème dark « Modern Heritage »)

Brutalisme raffiné, **thème sombre**. **Pas de classes utilitaires Tailwind** en pratique : **styles inline + variables CSS et classes de `globals.css`**.

- Polices (via `next/font`, **source de vérité = `src/app/layout.tsx`**) : **Fraunces** (`--font-display` : titres, noms, chiffres — remplace Spectral depuis 2026-07-12) · **Public Sans** (`--font-body` : UI / corps / labels — remplace Plus Jakarta Sans) · **IBM Plex Mono** (`--font-mono` : dates, IDs, inchangé). ⚠️ Ne PAS introduire Inter / Arial / Space Grotesk. La landing (`Landing.tsx`) charge **Fraunces seul** (scopé `--lp-serif`, axe `weight: 'variable'` pour couvrir les graisses fines 200/300 du hero).
- Couleurs (dark) : `--bg #111118` · `--bg-card #1e1e28` · `--ink #f5f0e8` · `--accent` **or muted `#c9a84c`** (⚠️ PAS le terracotta `#bf4b2c` de l'ancien thème clair) · `--text-muted #9094a6` (secondaire, ≥4.5:1) · `--text-light #888896` (tertiaire, ≥4.5:1). `--border-strong`, `--bw`, `--shadow`.
- **Zéro border-radius** : toute l'échelle `--radius*` = `0`. Pour les littéraux, mettre `0` — **exception : garder circulaires les vrais cercles** (spinner ring, `input[type=radio]`, points ronds).
- Classes utiles : `.card`, `.btn` / `.btn-primary` / `.btn-secondary`, `.label` (mono uppercase), `.serif`, `.mono`, `.input`.
- Cards : bordure `var(--bw) solid var(--border-strong)` + `box-shadow: var(--shadow)`. Chiffres mis en avant en or.
- Avant tout travail UI, lire `.claude/skills/impeccable/SKILL.md` (`PRODUCT.md` décrit produit/registre). Sous-commandes : `/impeccable polish|audit|critique|craft`. Audit UI/UX de référence : **`AUDIT-V4.md`** (racine).

## Mobile (`mobile/` — React Native / Expo)

App native compagnon (iOS/Android), même design « Atelier » que le web. **Projet séparé** avec son propre `package.json`/`node_modules`/`tsconfig` — toujours travailler **dans `mobile/`** (cd) et garder Node 22.

- **Stack** : **Expo SDK 54** (RN 0.81, React 19) · **Expo Router 6** (file-based, typed routes) · `react-native-svg` (arbre pan/pinch via `react-native-gesture-handler` + `react-native-reanimated` v4 — plugin babel `react-native-worklets/plugin`) · **Zustand + MMKV** (store/persistance) · **i18next + react-i18next + expo-localization** (FR/EN) · `@react-native-community/datetimepicker` · `expo-notifications` (+ `expo-device`) · `lucide-react-native`.
- **Identité app** (`app.json`) : `owner: ndjoumessi`, `ios.bundleIdentifier` / `android.package` = **`com.suimini.app`**, `ios.buildNumber "1"` / `android.versionCode 2` (bumpé lors du build APK local). Plugin `expo-image-picker` ajouté (permissions caméra/photos).
- **EAS Build** : projet `@ndjoumessi/suimini` (`extra.eas.projectId`). `mobile/eas.json` — 3 profils : **development** (devClient, internal, APK), **preview** (internal, Android APK + iOS simulator), **production** (store, Android AAB + iOS archive) ; `appVersionSource: local` (versions pilotées par `app.json`). `mobile/.easignore` exclut `node_modules`/`.expo`. Lancer **manuellement** : `cd mobile && eas build -p android --profile preview`.
  - ⚠️ **Quota gratuit** : le plan EAS gratuit limite les builds Android/mois (réinit. mensuelle) — un build de trop échoue avec « used its … builds from the Free plan ».
  - ⚠️ **Env du build** : `mobile/.env` n'est **pas committé** → un build EAS n'a PAS les `EXPO_PUBLIC_*` (→ mode démo). Les fournir sur EAS (valeurs = celles de `mobile/.env`), pour les 3 environnements à la fois, en **plaintext** (clé `anon` publique — ⚠️ jamais la `service_role`) :
    ```bash
    eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "<url>" \
      --environment development --environment preview --environment production \
      --visibility plaintext --scope project --non-interactive   # idem ANON_KEY ; --force pour réécrire
    ```
    Vérifier : `eas env:list --environment preview`.
  - CI : job `eas-build` (push `main`) = **type-check seul** dans `mobile/` (pas de build EAS en CI).
- **Commandes** (depuis `mobile/`, Node 22) :
  ```bash
  npm install
  npx tsc --noEmit                          # type-check
  npx expo export --platform android        # valide le bundle Metro (gate)
  npx expo-doctor                           # 18/18 attendu
  npx expo start                            # dev (⚠️ MMKV/push ne marchent pas dans Expo Go → dev build)
  ```
- **Données / store** (`lib/store.ts`, Zustand) : `seedDemo()` seed l'arbre démo (`sampleData.ts` = **Famille Dupont fictive**, 28 pers./5 gén.), `isDemo` global (pas dans `useAuth` — sinon l'AuthGate ne le voit pas). `refreshFromRemote()` **REMPLACE** les arbres par ceux de Supabase pour un user connecté (jamais de merge avec le démo) ; échec → garde le local + `syncStatus:'offline'`. `upsertPerson`/`removePerson` = écriture locale optimiste **puis** Supabase (skip si démo).
- **Auth** (`hooks/useAuth.ts`) : mêmes règles que le web (`onAuthStateChange` **synchrone**). Le chargement des arbres + l'enregistrement push se déclenchent dans `app/_layout.tsx` dès qu'une **vraie session** existe (lancement ou login).
- **i18n** : `lib/i18n.ts` (langue = choix persisté MMKV > langue du téléphone > `fr`). Chaînes dans `mobile/locales/{fr,en}.ts` (`en` typé sur `fr` → parité **à la compilation** : retirer une clé doit se faire des deux côtés sinon `tsc` casse). Tout texte UI passe par `t('clé')` ; toggle FR/EN dans `settings.tsx`. **Distinct du web** (qui utilise `next-intl` + `messages/`). Salutation `home` (`app/(tabs)/home.tsx`) : sans prénom (hors démo) on n'affiche **que** `home.greeting` (« Bonjour »/« Hello »), jamais un mot de repli type « vous ».
- **Stockage** : `lib/storage.ts` → `createKVStorage(id)` tente MMKV puis **repli mémoire** si le module natif est absent (Expo Go) — évite les crashs « missing default export ». `react-native-mmkv` est en **v2** (la v3 exige les TurboModules).
- **Push** : `lib/notifications.ts` (token Expo → POST `/api/push/register` côté web, best-effort). Table `supabase/push-tokens.sql` (RLS `user_id = auth.uid()`). Délivrance réelle = build de dev + déclencheur serveur (API Expo) à ajouter.
- **Assets** : `mobile/assets/{icon,splash,adaptive-icon}.png` générés via Pillow (polices Bricolage/Hanken des paquets `@expo-google-fonts`).

## Variables d'environnement

`.env.local` (non committé) et secrets Vercel :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (auth/données)
- `ANTHROPIC_API_KEY` (rapport narratif IA, server-only)
- `RESEND_API_KEY` (emails approbation / invitation / notification propriétaire, server-only) ; `RESEND_FROM` optionnel (sinon sandbox `onboarding@resend.dev`, qui ne délivre qu'à l'adresse vérifiée)

Sans les vars Supabase, l'app tourne en mode invité (localStorage).

⚠️ **Pas de `SUPABASE_SERVICE_ROLE_KEY`** dans le projet (ni `.env.local`, ni Vercel, ni CLI) — l'archi est anon-key + RLS. Les écritures prod (scripts `supabase/*.sql`) se lancent **manuellement dans le SQL Editor** (rôle privilégié → RLS contournée) ; impossible d'écrire en prod depuis l'agent.

L'app **mobile** lit les mêmes valeurs Supabase via `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `mobile/.env` (gitignoré ; mapper depuis les `NEXT_PUBLIC_*` de la racine). `EXPO_PUBLIC_PUSH_REGISTER_URL` optionnel.

## Tests & CI

- `e2e/` : `smoke.spec.ts`, `demo-flow.spec.ts`, `dashboard-screenshot.spec.ts`, et des specs de **captures** (`feature-screenshots*.spec.ts`) gardées en `test.skip(!!process.env.CI, …)` — interception réseau / popups → flaky en CI ; à lancer en local contre `E2E_BASE_URL`.
- `playwright.config.ts` : bloque le **service worker** (`serviceWorkers: 'block'`) — sinon un SW périmé casse les `reload()` en test. `E2E_BASE_URL` permet de viser un serveur déjà lancé (sinon un `npm run dev` est démarré).
- `.github/workflows/ci.yml` : jobs `build` (npm ci → tsc → build) puis `e2e` (build → `next start` → smoke tests). Actions épinglées en `@v6` (Node 24). Les secrets Supabase/Anthropic/Resend doivent exister côté repo GitHub.
- **Pattern de test dominant = pure-logic** (aucun navigateur) : faux client Supabase / fonctions pures, façon `sync-logic.spec.ts` (aussi `conflict-resolution`, `fuzzy-search`, `duplicate-detection`, `image-compression`, `ocr-normalization`, `gedcom-export`/`-nick-roundtrip`, `narrative-context`, `supabase-status`, `sw-update`, `print-preview`, `realtime-echo`). Lançables sans serveur : `E2E_BASE_URL=http://localhost:9999 npx playwright test <spec>`. En plus : `a11y.spec.ts` (axe-core, garde-fou WCAG) et `e2e/integration/` (vrai cloud, **self-skip** sans `SUPABASE_TEST_*`). **~31 fichiers de specs** (30 dans `e2e/` + `e2e/integration/`).
- **Autres workflows** : `backup-db.yml` (backup quotidien, secrets `SUPABASE_ACCESS_TOKEN`/`_PROJECT_ID`) · `integration-tests.yml` (tests cloud, secrets `SUPABASE_TEST_*`) · `migrate.yml` (framework de migrations, `workflow_dispatch` `command=baseline|migrate`) · `deploy-edge-functions.yml` (déploiement Edge Functions en CI).

## Pièges connus (à respecter)

- **`onAuthStateChange` doit rester synchrone** (`useAuth.ts`) : ne jamais `await` un appel Supabase dedans → deadlock GoTrue (le login reste bloqué sur « Connexion en cours… »). Différer via `setTimeout(0)`.
- **Logout sans crash** (`useAuth.ts`) : flag module-level `let isSigningOut` (+ `markSigningOut()` exporté). `onAuthStateChange` `return` tôt si le flag est posé, et `signOut` pose le flag **avant** `supabase.auth.signOut()` puis fait `window.location.replace('/')`. Sinon l'event `SIGNED_OUT` re-rend `/app` avec une session nulle → crash « Une erreur est survenue ».
- **Sweep de `border-radius` à 0** : OK de passer les littéraux à `0` (zéro-radius), mais **ne pas carrer les vrais cercles** (spinner = `border` + `borderTopColor` + animation `spin` ; `input[type=radio]` ; pastilles rondes). Un sweep aveugle a déjà transformé un spinner en carré tournant.
- **Committer `package.json` + `package-lock.json` ensemble** quand on ajoute une dépendance : sinon `npm ci` en CI/Vercel échoue (ex. oubli de `@playwright/test` / `next-intl`).
- Routes sous `app/_xxx/` = **privées** (non routables) ; ne pas s'en servir pour des pages réelles.
- `tsconfig.tsbuildinfo` est tracké (cache incrémental) ; en cas de tsc capricieux après suppression de routes, `rm -rf .next` puis rebuild.
- Partage public (`/arbre/[slug]`) : `force-dynamic` + RLS qui masque les fiches « privé » et n'expose jamais le journal. Migration : `supabase/share-public.sql` (manuelle).
- **PDF = navigateur, pas serveur** : `playwright`/Chromium ne tourne pas dans une route API Vercel (`@playwright/test` n'est qu'une *devDependency* pour `render.mjs` local + e2e). Générer le PDF côté client via fenêtre d'impression (`pdfTemplates.ts` / `PrintModal`), pas dans `/api/*`.
- **Lecture d'un profil tiers** : RLS bloque le `select` direct sur `profiles` d'un autre user → utiliser la RPC `get_public_profiles(ids)` (voir section Emails).
- **Web ≠ mobile** : deux projets, deux i18n (`next-intl`+`messages/` vs `i18next`+`mobile/locales/`), deux `useAuth`/`useFamilyStore`. Ne pas importer de l'un vers l'autre ; le modèle (`Person`/`Tree`) est **dupliqué** dans `mobile/lib/types.ts` (garder en phase). Vérifier `tsc`/`expo export` **dans `mobile/`** séparément du `tsc`/`build` racine.
- **Écriture prod bloquée depuis l'agent** : sans `service_role` key / mot de passe DB (absents partout), impossible d'exécuter un `supabase/*.sql` contre la prod — livrer le script et demander à l'utilisateur de le lancer dans le SQL Editor. **Astuce validation** : un Postgres jetable local (`initdb`/`pg_ctl`, dispo via Homebrew) permet de charger `RESTORE_TEDA_FROM_EXPORT.sql` puis de tester un script (comptes, refs pendantes, `owner_id` intact) avant livraison.
- **Sync : `extra` vs colonnes + gardes** — voir « Synchronisation Supabase » : `rowToPerson` fait primer les colonnes canoniques (un `updatedAt` dans `extra` casse le tri « Dernières modifications ») ; **plus de DELETE-par-diff** (l'ancien `syncChildTable`, cause de l'incident TEDA, n'existe plus) → `pushChildTable` UPSERT-only + `deleteChildRows` soft-delete ; login frais = hard-replace (flag `suimini_session_loaded`) ; échos Realtime de nos écritures filtrés par signature (`realtimeEcho.ts`).

## Conventions

- Commits en français, style `type: résumé` (`feat:`, `fix:`, `chore:`). Terminer par `Co-Authored-By: Claude …`.
- Travailler sur `main` (l'historique du repo est direct-sur-main). Pousser puis `vercel --prod` quand demandé.
- Préférer les styles inline + variables CSS du design system ; matcher le style du code environnant.
- **Tout texte UI passe par `t()`** (next-intl) ; ajouter la clé dans `messages/fr.json` **et** `en.json` (parité). Pas de chaîne en dur (toasts inclus — voir namespaces `toasts.*` / `app.*`).
- **Messages d'erreur actionnables** : format `« {ce qui a échoué} — {action} »` avec un chemin de récupération visible (bouton Réessayer/Retour). Préférer une clé **spécifique au contexte** (ex. `personForm.saveFailed`, `sharing.errGeneric`, `invite.errorTitle`) ; `common.error` (« Une erreur inattendue — Réessayer ») reste le **dernier recours générique**. ⚠️ Ne **pas** i18n-iser `app/error.tsx` / `app/global-error.tsx` (fallbacks volontaires qui doivent rendre même si le provider i18n a planté).
- **Couleurs de genre** : source unique `GENDER_BAR` (`src/components/tree/nodeStyle.ts`) — homme bleu `#4A90D9`, femme rose `#C47BA0`, inconnu `#3A3A4A`. Arbre, liste (`PersonCard`), `PersonAvatar` et exploration la consomment ; l'or `#c9a84c` est réservé au **pivot/fondateur**, jamais au genre.
- **Vue Complète (SVG) virtualisée** : `TreeView` ne monte que les nœuds/connecteurs intersectant le viewport ±200 px (`visibleNodes/Edges/Pearls`, calculés depuis `offset/scale/viewport`) — coût indépendant de la taille de l'arbre (~31 nœuds montés à 70 comme à 200 personnes). ⚠️ Pièges : le conteneur (`containerRef`) n'existe qu'en mode « full » → les effets de mesure/ResizeObserver dépendent de `treeMode` ; `.tv-node-inner` a `opacity:0` révélée par l'animation `forwards` → après l'entrée on met `animationDuration/Delay: 0ms` (JAMAIS `animation:'none'`, qui rend les nœuds invisibles). Minimap/fit-to-screen utilisent les bornes complètes (tous les nœuds).
- **Tokens couleur** : plus de littéraux égaux aux tokens dans `src/` (remplacés par `var(--bg)`, `var(--bg-card)`, `var(--ink-on-accent)`…). Exceptions légitimes en hex : `pdfTemplates`/`PrintModal` (fenêtre d'impression), `emails.ts`, `Landing.tsx` (palette scopée), `nodeStyle.ts`/GENDER_BAR, `themes.ts`, et **`theme-color`** (meta — ne résout pas les CSS vars : littéral `#111118` dans `layout.tsx` + `useDarkMode`).
- **Fiche personne / nœud** : `nameLines` (`nodeStyle.ts`) → `primary` = `firstName` (gras), `secondary` = `lastName` (atténué). **NOM optionnel** : `PersonForm` exige au moins **un** des deux (prénom OU nom) ; `getDisplayName` est null-safe/`trim()` (nom unique type MESSE/TEDA). Le **surnom** (`nickName`) s'affiche en 3ᵉ ligne italique/discrète **sans guillemets** dans **les 3 rendus** : FocusTree (`TreeNode.tsx` + `.ft-nickname`), TreeView « Complète » (SVG, pile centrée), Visual tree PDF (`PrintModal`). ⚠️ Il y a **deux renderers d'arbre** : vue « Focus » = `FocusTree` (HTML), vue « Complète » = SVG dans `TreeView` — modifier les deux.
- **Recherche → nœud** : sélectionner un résultat de la CommandPalette bascule sur la vue Arbre et **recentre** l'arbre sur la personne (prop `navTarget` → `pickRoot` dans `TreeView`, effacé via `onNavConsumed`).
- **Barre undo/redo** (`HistoryIndicator`, vue Arbre seule) : éphémère — apparaît quand l'historique change, **auto-fermeture 4 s**, clic extérieur, démontée à la navigation. L'undo reste au clavier (Cmd/Ctrl+Z).
- **Modales** : utiliser le hook `useOverlay(onClose, { enabled? })` (focus-trap + Esc + verrou de scroll + restauration du focus ; `enabled:false` pour les surfaces non modales — ex. PersonPanel n'est un dialog piégé **que** sur mobile plein écran) ; ne pas réimplémenter à la main. Le composant doit être **monté seulement quand ouvert** (le hook agit au mount). Poser soi-même `role="dialog" aria-modal aria-labelledby` (le hook ne gère que le comportement). Le `:focus-visible` est global dans `globals.css`.
- **Accessibilité (WCAG 2.1 AA — état : 0 violation axe, voir `ACCESSIBILITE_RAPPORT.md`)** : garde-fou `e2e/a11y.spec.ts` (axe-core sur landing + app démo + modales — le faire passer avant commit UI). Réflexes : icône décorative → `aria-hidden` / bouton icône-seule → `aria-label` ; champ → `<label htmlFor>`/`aria-label` (jamais placeholder seul) ; erreurs → `role="alert"` + `aria-describedby` + `aria-invalid` ; toggles → `aria-pressed` ; info jamais portée par la couleur seule (genre dit dans l'aria-label des nœuds, sr-only si besoin) ; `.sr-only` et `.skip-link` existent dans `globals.css` (cible `#main-content` sur chaque `<main>`) ; texte sur or = encre `#0d0d0d` (le blanc échoue à 2.28:1) ; pas de `maximumScale` dans le viewport ; conteneur de toasts = live region permanente (Toast.tsx).
- **Pages légales** (`/cgu`, `/confidentialite`) : composant client partagé `LegalDoc.tsx` + namespaces `cgu.*` / `privacy.*` (rich text via `t.rich` avec tags `<b>`).
