# Audit d'architecture logicielle — Suimini

**Date** : 16 juillet 2026 (re-vérification post-AUDIT-V5, commit `75e5cff`) · **Périmètre** : monorepo complet (web Next.js 16 `src/`, mobile Expo `mobile/`, backend hybride Supabase + Railway, storage R2, relais temps réel) · **Méthode** : lecture de CLAUDE.md et de l'audit précédent (commit `8ba0093`), puis **re-vérification systématique dans le code actuel** de chaque affirmation, avec citation `fichier:ligne` lue directement. Audit en lecture seule ; seul ce rapport a été écrit.

**Contexte** : un audit d'architecture avait été produit au commit `8ba0093` et identifiait 3 bugs de production majeurs (F1–F3). Depuis, la session AUDIT-V5 (5 commits, `1f0c57e` → `75e5cff`) a corrigé UI/UX/accessibilité **sans intention de toucher au backend**. Ce rapport vérifie que c'est bien le cas, statue explicitement sur F1/F2/F3, et re-déroule l'audit complet à l'état courant.

> **Mise à jour (2026-07-16, même journée)** : F1, F2, F3, F4, F5, F8, F9 (documenté), F10, F11, F12 (vérifié), F13 ont tous été traités dans une session de correctifs qui a suivi cet audit — voir le tableau récapitulatif en bas de page pour le détail par finding. F6 a reçu une analyse écrite (`docs/f6-scalability-analysis.md`) plutôt qu'un correctif direct (risque jugé trop élevé pour un refactor à l'aveugle du moteur de sync, sans environnement de staging). F7 (routes `/api/data/*` sans tests 401/403 dédiés) reste ouvert. Le texte ci-dessous, écrit AVANT ces correctifs, est conservé tel quel comme trace de l'état constaté à l'audit ; ne pas le lire comme l'état actuel du code.

## Verdict global (état À L'AUDIT — voir mise à jour ci-dessus pour l'état actuel)

L'architecture de migration incrémentale de Suimini (seams `DataClient`/`DataStore`, flags à plusieurs étages, impls passe-plat comme chemin de rollback) reste d'une qualité rare pour un projet de cette taille — le patron est appliqué de façon identique cinq fois, les fail-safes sont systématiquement du bon côté, et la session AUDIT-V5 a été d'une discipline exemplaire (46 lignes modifiées dans `ShareModal.tsx`, toutes UI : modale de confirmation + toast, aucun import de données touché). **Mais les 3 bugs de production identifiés au dernier audit sont tous les trois toujours actifs, à l'identique** : le partage email/public écrit toujours dans le Supabase figé, le flux d'invitation anonyme lit toujours le mauvais backend, et le « rollback en une ligne » est toujours documenté comme instantané alors qu'il détruirait les éditions post-cutover. Rien d'étonnant — la session intermédiaire ne visait pas l'architecture — mais chaque jour qui passe élargit la fenêtre de données perdues (invitations envoyées dans le vide, partages fantômes, delta Railway↔Supabase qui grossit). Ces trois points doivent passer avant toute nouvelle feature.

---

## Statut des 3 bugs prod précédemment identifiés

### F1 — Partage par email + partage public contournent la frontière → **✅ CORRIGÉ (2026-07-16)**

Les 5 fonctions (`shareTree`/`listShares`/`unshareTree`/`getPublicShare`/`setTreePublic`) passent désormais par `DataStore` (`*ViaApi` + routes `/api/data/trees/[id]/share|public`) ; `loadPublicTree` idem côté serveur. Section ci-dessous conservée telle qu'écrite à l'audit (documente le bug, pas l'état actuel).

### F1 — état à l'audit (avant correctif)

Vérifié au code du 16/07 :

- `src/components/ShareModal.tsx:6` importe toujours `shareTree, listShares, unshareTree, getPublicShare, setTreePublic` depuis `@/lib/supabaseSync` — aucune variante `*ViaApi`, aucun passage par `getDataClient()`.
- Les cinq fonctions parlent au client Supabase **en direct** :
  - `shareTree` → `supabase.from('tree_shares').upsert(...)` (`src/lib/supabaseSync.ts:433-440`) ;
  - `listShares` → `supabase.from('tree_shares').select(...)` (`supabaseSync.ts:442-446`) ;
  - `unshareTree` → `.delete()` direct (`supabaseSync.ts:448-451`) ;
  - `getPublicShare` → `supabase.from('trees').select('is_public, public_slug')` (`supabaseSync.ts:456-460`) ;
  - `setTreePublic` → `supabase.from('trees').update(patch)` (`supabaseSync.ts:466-472`).
- La page publique `/arbre/[slug]` lit toujours `loadPublicTree` (`src/app/arbre/[slug]/page.tsx:3,15,32`), qui crée un client anonyme Supabase et lit `trees`/`persons`/`relationships` en direct (`supabaseSync.ts:479-509`).

Le diff `8ba0093..HEAD` sur `ShareModal.tsx` (48 lignes) ne touche que l'UX (remplacement de `window.confirm` par une modale in-app, toast « Copié » pour lecteurs d'écran) ; `supabaseSync.ts`, `sharing.ts` et `railwayStore.ts` n'ont pas bougé d'une ligne sur ce périmètre.

**Conséquences (inchangées) depuis `DB_BACKEND=railway` à 100% (2026-07-11)** : un nouveau partage par email écrit dans le `tree_shares` Supabase figé, jamais dans celui que lit l'AuthZ (`createRailwayAuthzProvider().getTreeSharePermission` lit le `tree_shares` **Railway**, `src/lib/railwayStore.ts:32-38`) → le partage ne prend jamais effet, sans erreur. `setTreePublic` sur un arbre créé post-cutover matche 0 ligne dans Supabase → lien public mort-né. `/arbre/[slug]` sert des données figées au 11/07.

### F2 — Flux d'invitation anonyme `/invite/[token]` lit Supabase, invitations écrites sur Railway → **✅ CORRIGÉ (2026-07-16)**

`get_invitation` est maintenant exempté de session côté route (`ANON_ALLOWED`, `/api/data/rpc/[name]/route.ts`) et `getInvitation` route toujours vers l'API. Section ci-dessous conservée telle quelle (état à l'audit).

### F2 — état à l'audit (avant correctif)

Chaîne re-vérifiée maillon par maillon :

1. `src/app/invite/[token]/page.tsx:42` appelle `getInvitation(token)` avant toute session.
2. `getInvitation` → `callRpc('get_invitation', ...)` (`src/lib/sharing.ts:186-192`).
3. `callRpc` route selon `getDataLayer()` (`src/lib/rpcClient.ts:37-39`) ; pour un visiteur anonyme, le défaut serveur est résolu par `GET /api/data-layer` qui renvoie **toujours `direct`** sans session : `if (!caller) return NextResponse.json({ layer: 'direct' })` (`src/app/api/data-layer/route.ts:21`), choix explicitement documenté dans le fichier (« le chemin invitation `get_invitation` pré-login DOIT rester direct », `route.ts:12-14`).
4. Donc l'anonyme exécute la RPC `get_invitation` **sur Supabase** — où le token n'existe pas si l'invitation a été créée post-cutover : `inviteMember` en mode `api` passe par `POST /api/data/collaboration/members` (`src/lib/sharing.ts:89-91,132-143`) → `RailwayStore.inviteMember` écrit `tree_members` **Railway** uniquement.
5. Même si le client anonyme tentait le chemin `api`, la route RPC exige une session : `if (!caller) return ... 401` (`src/app/api/data/rpc/[name]/route.ts:27`) — il n'existe **aucun chemin anonyme vers Railway**.
6. Le commentaire justificatif est toujours là et toujours périmé : « *(En mode api, l'appel anonyme /invite reste sur Supabase ; ce chemin ne sert qu'un appelant authentifié allowlisté.)* » (`src/lib/railwayStore.ts:438-440`) — l'allowlist a été retirée le 11/07 (`DB_BACKEND_ALLOWLIST` vide = tous, `src/lib/dataStore.ts:144-146,153`), la prémisse est fausse depuis 5 jours.

**Conséquence** : tout nouvel invité non connecté qui clique le lien d'email voit « invitation invalide ». C'est le chemin d'onboarding n°1 d'un produit collaboratif. (Nuance : l'auto-accept post-login via `PENDING_INVITE_KEY` passe, lui, par un utilisateur authentifié routé `api` → Railway — mais l'invité ne pose jamais ce token puisque la page lui a dit que l'invitation était invalide avant l'écran de connexion.)

### F3 — « Rollback en une ligne » documenté comme instantané/sûr, sans copie inverse Railway→Supabase → **✅ CORRIGÉ (2026-07-16)**

`docs/railway-migration.md`/`CLAUDE.md` requalifiés (rollback = frein d'urgence, pas lossless) + `railway/reverse-copy-to-supabase.sh` écrit et testé (mocké). Section ci-dessous conservée telle quelle (état à l'audit).

### F3 — état à l'audit (avant correctif)

- `docs/railway-migration.md:12-14` affirme toujours : « **ROLLBACK INSTANTANÉ (une ligne, network-only, sans redeploy)** : remettre l'Edge Config `data_layer` à `{"default":"direct",...}` → tous en `direct`→Supabase. » ; `CLAUDE.md:128` répète mot pour mot la même promesse.
- La ligne juste au-dessus (`railway-migration.md:11`) — « Données Supabase copiées + intégrité vérifiée. **Supabase = source de vérité, jamais modifié.** » — est désormais **fausse dans son premier terme** : depuis le 11/07, la source de vérité est Railway ; Supabase est un instantané figé à J-5 (moins les écritures fantômes de F1 qui, elles, continuent d'y tomber).
- **Aucun script de copie inverse n'existe** : `railway/` ne contient que `schema.sql` et `realtime-notify.sql` ; `scripts/` ne contient que `migrate.mjs` (Supabase), les générateurs d'assets, les scripts R2 et le relais realtime. Aucune occurrence de `pg_dump`/`pg_restore`/copie inverse dans `scripts/` ni `railway/`.

**Conséquence** : actionner ce rollback aujourd'hui renverrait tous les utilisateurs sur des arbres amputés de 5+ jours d'éditions, et l'architecture local-first ajouterait du chaos (clients rolled-back ré-upsertant leur cache récent dans Supabase → troisième version des données). Le mécanisme reste précieux comme **frein d'urgence**, mais la documentation le vend comme indolore. La fenêtre de perte grandit chaque jour.

---

## 1. Frontières et abstractions (`DataClient` / `DataStore`)

Le cœur est toujours exemplaire : `getDataClient()` (`src/lib/dataClient.ts:170-172`) est bien l'unique frontière réseau du store ; `getDataStore(client, caller)` (`src/lib/dataStore.ts:162-168`) l'unique frontière backend des routes ; l'invariant « l'AuthZ tourne sur le même backend que les données » est câblé via `store.authz` (`dataStore.ts:58-59`, `railwayStore.ts:144`). Les findings ci-dessous sont les fuites autour de ce cœur.

**F1 · Majeur (bug prod actif)** — Partage email + partage public hors frontière. Voir section statut ci-dessus. *Recommandation* : ajouter les 5 opérations au `DataStore` (+ `GET /api/data/public/[slug]` pour la page publique, prévu dans le design Phase 0 et jamais livré), variantes `*ViaApi` dans `supabaseSync` ou un nouveau `sharing-links.ts`, et décider du sort des lignes `tree_shares` écrites dans Supabase depuis le 11/07 (re-copie vers Railway). Entre-temps, masquer l'UI de partage par email plutôt que de laisser écrire dans une base morte.

**F2 · Majeur (bug prod actif)** — Invitation anonyme sur le mauvais backend. Voir section statut. *Recommandation* : autoriser `get_invitation` **sans session** sur `/api/data/rpc/get_invitation` (c'est une RPC par-token, déjà conçue pour fonctionner déconnecté — le token EST la capacité), la servir par `getDataStore(client, null)` (qui résout déjà Railway pour un caller null quand l'allowlist est vide, `dataStore.ts:149-155`), et faire pointer `getInvitation` côté client vers l'API même hors session. Tests : token Railway visible pré-login ; token inexistant → invalide.

**F8 · Mineur** — **✅ Corrigé (2026-07-16)** : export-pdf/send-approval-email/push-notify-join routés via `DataStore` ; `subscribeComments` documenté comme inerte (pas de correctif — voir le commentaire dans `collaboration.ts`, le relais realtime ne couvre pas encore `person_comments`). Détail à l'audit ci-dessous :
- `subscribeComments` écoute `postgres_changes` sur le `person_comments` **Supabase** (`src/lib/collaboration.ts:144-150`), consommé par `PersonPanel.tsx:269` — or les commentaires s'écrivent sur Railway : le live-comment ne se déclenche plus jamais.
- `/api/export-pdf` lit `trees`/`persons`/`relationships` Supabase en direct (`src/app/api/export-pdf/route.ts:85-90`) → livret secondaire généré sur données figées.
- `/api/push/notify-join` (`route.ts:47`) et `/api/send-approval-email` (`route.ts:43`) lisent `from('trees')` Supabase → pour un arbre créé post-cutover, la notification au propriétaire échoue silencieusement.

*Recommandation commune à F1/F2/F8* : un test pure-logic « inventaire de frontière » qui échoue si un fichier hors liste blanche (`supabaseSync.ts`, `authz.ts`, `dataStore.ts`, routes `/api/data/*`) référence une table du data-plane (`from('trees'|'persons'|'tree_shares'|…)`). Ce seul garde-fou aurait attrapé les trois findings d'un coup et empêchera leurs successeurs.

## 2. Duplication web/mobile

Choix toujours raisonnable (deux projets, convergence par l'API plutôt que code partagé). Dérive résiduelle confirmée au code :

**F11 · Mineur** — **✅ Corrigé (2026-07-16)** : `e2e/person-parity.spec.ts` compare les champs des deux `interface Person` (allowlist explicite pour `media`/`photoTags`, échoue sur toute autre divergence). Constat original conservé ci-dessous.

`Person` mobile (`mobile/lib/types.ts:77-114`) n'a ni `media?: Media[]` ni `photoTags?: PhotoTag[]`, présents côté web (`src/types/index.ts:98,105`). `preserveExtra` côté serveur protège ces champs d'un écrasement, mais rien ne teste cette protection pour ces champs précis, et l'en-tête du fichier mobile (« Keep in sync when the web model changes », `types.ts:1-5`) est un vœu, pas un mécanisme.

## 3. Couplage RLS ↔ `authz.ts` — quatre sources de vérité

**F4 · Majeur (préventif)** — **✅ Corrigé (2026-07-16)** : `createRailwayAuthzProvider` rendu injectable (`queryFn`) + `e2e/authz-parity.spec.ts` joue la même fixture contre les deux providers réels (16 cas). `RAILWAY_TEST_DATABASE_URL` toujours absent des secrets CI (accès GitHub Secrets requis, hors de portée d'un agent). Constat original ci-dessous :
1. les policies RLS SQL (Supabase, encore actives pour le chemin `direct`) ;
2. `createSupabaseAuthzProvider` (`src/lib/authz.ts`) ;
3. `createRailwayAuthzProvider` (`src/lib/railwayStore.ts:26-51`) ;
4. la visibilité ré-implémentée en SQL brut **hors prédicats** dans `RailwayStore.loadTrees` (`railwayStore.ts:146-160` : owner OU membre accepté OU `tree_shares` par email) et `canManageMembers` (`railwayStore.ts:383-392`).

Depuis le 100% Railway, il n'y a **plus de RLS en filet** sur le chemin nominal : un bug de provider = fuite inter-locataire directe. `e2e/authz.spec.ts` valide les prédicats contre un provider en mémoire, jamais la parité entre implémentations réelles ; `e2e/integration/railway-store.spec.ts` est self-skip sans `RAILWAY_TEST_DATABASE_URL` (`spec.ts:10,22`) et ce secret n'est **pas** dans la CI (`.github/workflows/integration-tests.yml:35-37` ne passe que les 3 `SUPABASE_TEST_*`). Aucune divergence constatée aujourd'hui — les copies sont alignées — mais rien ne le garantit demain. *Recommandations* : test de parité pure-logic entre les deux providers sur une table de vérité commune ; ajouter `RAILWAY_TEST_DATABASE_URL` aux secrets CI ; faire passer `loadTrees`/`canManageMembers` par les prédicats `authz.ts` (ou documenter le lien inverse).

## 4. Stratégie de tests

Inventaire vérifié : **33 fichiers de specs** (31 dans `e2e/` + 2 dans `e2e/integration/`), ratio pure-logic/navigateur toujours adapté au profil de risque (sync/merge/authz), `a11y.spec.ts` en garde-fou.

**F7 · Mineur** — **✅ Traité, volet 401 (2026-07-16)** : `e2e/api-data-authn.spec.ts` — balayage 401 anonyme sur les ~22 routes `/api/data/*` (requêtes HTTP réelles contre un serveur Next vivant, pas pure-logic), incluant les 3 exceptions délibérées (`whoami`, `my-memberships` fail-open, exemption anonyme `rpc/get_invitation`) et la whitelist RPC. Chaque prédiction de statut a été vérifiée manuellement contre un `next dev` réel (curl) faute de pouvoir faire tourner Chromium+Playwright de bout en bout dans ce sandbox. **Volet 403 (droits) et happy-path restent un gap documenté** — nécessitent un compte de test réel (`SUPABASE_TEST_*`), absent de cet environnement ; à couvrir dans `e2e/integration/` avec le même patron self-skip que `railway-store.spec.ts` (cf. F4) quand ces secrets existeront. Constat original :

(a) les route handlers `/api/data/*` eux-mêmes (401/403/happy-path) — c'est pourtant là que vit l'unique AuthZ post-RLS ; (b) exactement le périmètre de F1/F2/F8 (`loadPublicTree`, `shareTree`, flux `/invite`) — corrélation non fortuite : les chemins non testés sont ceux qui ont dérivé ; (c) `railway-store.spec.ts` jamais exécuté en CI (cf. F4).

## 5. Migrations SQL

**F5 · Majeur (latent)** — **✅ Corrigé (2026-07-16)** : `railway/migrations/0001_schema.sql` + `scripts/migrate-railway.mjs` + `.github/workflows/migrate-railway.yml` (secret `RAILWAY_DATABASE_URL_UNPOOLED` pas encore posé côté GitHub — action manuelle restante). Constat original :

Railway n'avait aucun framework de migration : `railway/` = `schema.sql` + `realtime-notify.sql`, pas de `railway/migrations/`, pas de table de tracking, application manuelle `psql` sur l'URL unpooled — pour le schéma qui porte désormais 100% des données de production. Le framework Supabase (`supabase/migrations/0001-0017` + `scripts/migrate.mjs`) est propre mais migre un backend en fin de vie pour le data-plane. *Recommandation* : créer `railway/migrations/` en réutilisant `migrate.mjs` (paramétré sur `RAILWAY_DATABASE_URL` unpooled).

**F14 · Observation** — **✅ Corrigé (2026-07-16)** : bandeau « miroir historique, ne plus éditer directement » ajouté en tête des 16 fichiers `supabase/*.sql` qui ont un équivalent en migration versionnée (les 3 scripts sans équivalent — `cleanup-demo-tree.sql`, `cleanup-extra-duplicates.sql`, `seed-admin.sql` — restent la voie normale, à dessein). Constat original : double système Supabase (miroirs racine `supabase/*.sql` + migrations versionnées) : toujours synchronisé, discipline purement manuelle. Geler officiellement les miroirs (bandeau « historique ») ou check CI de dérive.

## 6. Scalabilité (croissance 10×)

**F6 · Majeur (horizon)** — **📄 Analysé, non corrigé (2026-07-16)** : `docs/f6-scalability-analysis.md` — refactor jugé trop risqué à l'aveugle (même sous-système que l'incident TEDA), plan en 3 étapes proposé, feu vert explicite requis avant tout code. Constat original :

Écriture O(taille de l'arbre) à chaque édition : `saveTreeToSupabase` ré-upserte **toutes** les persons/relationships/journal à chaque save (`src/lib/supabaseSync.ts:417-420`), déclenché à chaque CRUD (debounce 0–700 ms, `src/hooks/useFamilyStore.ts:512,780-781`) ; `RailwayStore.saveTree` (`railwayStore.ts:204`) reproduit fidèlement ce modèle. Invisible à 71 personnes ; à 1000+, chaque édition = ~1000 lignes upsertées + `preserveExtra` en SELECT préalable. La lecture est symétrique (chargement intégral de tous les arbres, ré-exécuté au retour de focus >10 s). Les mitigations existent déjà dans le repo : modèle patch du mobile, et le relais LISTEN/NOTIFY (code posé, inerte) qui supprimerait le resync-au-focus. *Recommandation* : porter le modèle patch au web avant que les arbres ne grossissent ; activer le relais.

Points tenables confirmés : virtualisation TreeView réelle, PgBouncer devant le pool (`max:10`), rate-limit IA durable. **Mineur non bloquant** : localStorage comme cache intégral (plafond ~5 Mo) ; relais realtime mono-connexion (SPOF assumé, fallback documenté).

## 7. Cohérence des conventions

**F12 · Mineur** — **✅ Vérifié (2026-07-16), pas de changement** : le package npm `server-only` ne peut PAS être ajouté à `railwayStore.ts`/`dataStore.ts`/`dataLayerConfig.ts` sans casser les specs Playwright qui les importent directement en Node (hors aliasing webpack) — voir commentaire dans `dataLayerConfig.ts`. Risque réel nul (grep confirme aucun import client). Constat original :

`src/lib/` : 42 fichiers à plat mêlant utilitaires purs, clients navigateur et modules server-only. Progrès depuis le dernier audit : `import 'server-only'` est posé dans `r2.ts`, `storageProvider.ts`, `railwayDb.ts` — mais **pas** dans `railwayStore.ts`, `dataStore.ts`, `apiData.ts`, `apiAuth.ts`, `dataLayerConfig.ts`, qui n'en sont protégés que par la discipline. Le nommage historique reste trompeur : `supabaseSync.ts` contient les mappers utilisés par Railway ET les cinq fonctions de partage oubliées (cause racine plausible de F1 : les passes de migration ont traité `sharing.ts`/`collaboration.ts`, pas le fond de `supabaseSync.ts`). *Recommandation* : une ligne `import 'server-only'` par module serveur ; extraire le partage-lien dans un fichier dédié lors du fix F1.

## 8. Dette technique explicite

**F13 · Observation** — **✅ Partiellement traité (2026-07-16)** : `fetchMembers` supprimé (code mort confirmé) ; commentaire périmé sur `railwayStore.ts` corrigé lors du fix F2. `sharedByName: 'un collaborateur'` en dur reste tel quel (régression cosmétique mineure, nécessiterait de faire résoudre `get_public_profiles` depuis le scope Railway — non fait, faible priorité). Constat original :

Dette non marquée (zéro TODO/FIXME dans le code), trouvée par lecture :
- `fetchMembers` (`src/lib/sharing.ts:56-65`) : aucun appelant dans `src/` — code mort.
- Commentaire périmé « appelant authentifié allowlisté » (`railwayStore.ts:438-440`), cf. F2.
- `sharedByName: 'un collaborateur'` en dur côté Railway (`railwayStore.ts:172`) — régression cosmétique vs Supabase (qui résolvait le vrai nom), et chaîne non i18n-isée.

## 9. Santé de la documentation (CLAUDE.md)

**F10 · Mineur** — **✅ Corrigé (2026-07-16)** : les 5 dérives listées ci-dessous ont toutes été corrigées dans CLAUDE.md (palette Marine Deep, rate-limit 10/h, AUDIT-V5, compte de specs, promesse de rollback requalifiée). Constat original :

CLAUDE.md : 305 lignes / **61 Ko** (~200 caractères par ligne — un journal de bord compressé). Ses invariants « pièges connus » restent exacts (tous ceux re-vérifiés ici l'étaient), mais sa section « état courant » a dérivé du code :
- Design : « braise chaude », `--bg #16120e` (`CLAUDE.md:210,213`) — le code dit `--bg: #0f1a24 /* Marine Deep */` (`src/app/globals.css:46`) depuis le passage au navy.
- « Rate limiting … `narrative` 3/h » en tête de section vs « relevé 3→10/h » plus bas — le code dit 10/h (`src/lib/rateLimit.ts:18`).
- « Audit UI/UX de référence : AUDIT-V4.md » (`CLAUDE.md:220`) — obsolète, AUDIT-V5.md existe et est le dernier appliqué.
- « ~31 fichiers de specs » — il y en a 33.
- La promesse de rollback « une ligne » (`CLAUDE.md:128`) sans mention de perte de données (cf. F3).

*Recommandation* : séparer invariants (stables, restent dans CLAUDE.md) et état/journal daté (`docs/STATUS.md`), et corriger les 5 dérives ci-dessus en une passe.

## 10. Rollback story — chaque flag, un par un

| Levier | Flag | Mécanisme de retour | Verdict vérifié |
|---|---|---|---|
| Transport navigateur | cookie `suimini_data_layer` + Edge Config `data_layer` | instantané, network-only (`dataClient.ts:159-164`, `data-layer/route.ts`) | ✅ mécaniquement sûr, ❌ **sémantiquement destructif** (F3) |
| Backend serveur | `DB_BACKEND` (env) | redeploy (`dataStore.ts:138-155`, fail-safe `supabase` si Railway non configuré) | ✅ propre, même caveat de données que F3 |
| Memberships | `NEXT_PUBLIC_MEMBERSHIPS_VIA_API` | retirer le flag + redeploy (`sharing.ts:238-248`, court-circuit total) | ✅ |
| Storage | `NEXT_PUBLIC_STORAGE_BACKEND='r2'` | build-time (`storageProvider.ts:165-173`) | ⚠️ **F9** ci-dessous |
| Realtime Railway | `NEXT_PUBLIC_REALTIME_BACKEND` / `EXPO_PUBLIC_*` | flag absent = inerte, purement additif | ✅ le plus propre des cinq |

**F3 · Majeur** — voir section statut : le rollback transport/backend est « une ligne » mécaniquement mais détruirait les éditions post-cutover ; aucun script de copie inverse. *Recommandation* : (1) requalifier immédiatement dans `docs/railway-migration.md` et `CLAUDE.md` en « frein d'urgence avec perte des éditions post-11/07 assumée » ; (2) écrire le script de copie inverse Railway→Supabase (miroir du `pg_restore` aller, FK-ordonné) et le documenter comme prérequis d'un rollback non urgent.

**F9 · Mineur** — **📄 Documenté (2026-07-16), pas exécutable par un agent** : `docs/f9-r2-custom-domain-checklist.md` — nécessite le dashboard Cloudflare (accès non fourni). Constat original : Storage : rollback partiellement fictif. Le flag est build-time et ne re-route que les **nouveaux** uploads ; depuis `scripts/rewrite-photo-urls-to-r2.mjs`, les URLs existantes pointent vers R2 quoi qu'il arrive — retirer le flag ne restaure pas l'affichage si R2 tombe. Domaine public `pub-*.r2.dev` (URL « Development » Cloudflare) à remplacer par un domaine custom avant que ça compte.

**Recommandation transversale** : `/admin/health` existe (`src/app/admin/health/`) — lui faire afficher et colorer en rouge toute combinaison de flags incohérente (`DB_BACKEND=railway` + `data_layer.default=direct`, flag memberships sans mode api, etc.) : garde-fou à coût quasi nul.

---

## Bonnes pratiques confirmées (vérifiées au code)

Pour que ce rapport ne soit pas faussement alarmiste — ce qui suit a été lu et tient :

1. **Le patron seam + impl passe-plat + impl neuve + flag + rollback, appliqué 5 fois à l'identique** : `DataClient` (`dataClient.ts:35-45` SupabaseDataClient = pur passe-plat rollback), `DataStore` (`dataStore.ts:90-133` SupabaseStore idem), `StorageProvider` (`storageProvider.ts:165-173`), memberships (`sharing.ts:238-248`), realtime (flag absent = rien ne change). Une vraie convention d'architecture, pas un accident.
2. **Fail-safe systématiquement du bon côté** : Edge Config illisible → `FALLBACK_RULE = direct` (`dataLayerConfig.ts:25,39-42`) ; `/api/data-layer` injoignable → `direct` (`dataClient.ts:144-146`) ; `DB_BACKEND=railway` sans chaîne de connexion → SupabaseStore (`dataStore.ts:151`).
3. **Rollout déterministe sans clignotement** : `bucketOf` FNV-1a pur, ensemble `{bucket < apiPercent}` monotone (`dataLayerConfig.ts:52-59`) — un user ne repasse jamais api→direct par accident.
4. **Défense en profondeur là où elle a été pensée** : garde anti-hijack cross-tenant dans l'upsert Railway (`where table.tree_id = excluded.tree_id`, `railwayStore.ts:100-108`) ; `preserveExtra` scopé par `tree_id` contre la fuite d'`extra` inter-arbres (`railwayStore.ts:120-124`) ; `loadPublicTree` en allowlist de colonnes explicite, jamais `select('*')` anonyme sur `trees` (`supabaseSync.ts:484-488`) + re-filtrage des fiches privées côté serveur (`supabaseSync.ts:496-500`).
5. **Une seule source de vérité pour les mappers** : `RailwayStore` importe `personToRow`/`rowToPerson`/… de `supabaseSync` (`railwayStore.ts:14-17`) — l'invariant « les colonnes priment sur extra » n'existe qu'à un endroit.
6. **Sync UPSERT-only + soft-delete** réellement en place (aucun DELETE-par-diff retrouvé ; seul DELETE dur = arbre entier, `supabaseSync.ts:423-429` borné par `owner_id`).
7. **Détails d'ingénierie soignés** : plafond `keepalive` 60 Ko documenté avec la raison navigateur (`dataClient.ts:53-56`) ; `getServerAuth` avec `setAll` réel pour persister le refresh de token (`apiAuth.ts:44-53`) ; `import 'server-only'` posé sur les 3 modules à secrets (`r2.ts`, `storageProvider.ts`, `railwayDb.ts`).
8. **Discipline de la session AUDIT-V5** : le diff `8ba0093..75e5cff` sur les fichiers de la couche données est vide ; `ShareModal.tsx` n'a reçu que de l'UI (modale de confirmation `useOverlay`, toast a11y) — l'intention « ne pas toucher au backend » a été tenue.
9. **Stratégie de tests pure-logic** (20+ specs sans navigateur, faux clients injectables) : le bon outil pour le profil de risque du projet, et la raison pour laquelle la recommandation n°1 (test d'inventaire de frontière) est réaliste à coût faible.

---

## Tableau récapitulatif

| # | Finding | Sévérité | Statut (2026-07-16, fin de journée) |
|---|---|---|---|
| F1 | Partage email + partage public écrivent/lisent le Supabase figé (`supabaseSync.ts:433-509`, `ShareModal.tsx:6`, `/arbre/[slug]`) | **Majeur** (bug prod) | **✅ Corrigé** |
| F2 | `/invite/[token]` anonyme lit Supabase, invitations écrites sur Railway (`invite/[token]/page.tsx:42` → `data-layer/route.ts:21` → RPC Supabase) | **Majeur** (bug prod) | **✅ Corrigé** |
| F3 | Rollback « une ligne » documenté comme instantané/sûr, aucune copie inverse Railway→Supabase (`railway-migration.md:12-14`, `CLAUDE.md:128`) | **Majeur** | **✅ Corrigé** |
| F4 | AuthZ en 4 exemplaires sans test de parité ; `railway-store.spec.ts` jamais en CI | **Majeur** (préventif) | **✅ Corrigé** (test de parité pure-logic ; secret CI toujours manquant, action manuelle) |
| F5 | Railway sans framework de migrations versionnées | **Majeur** (latent) | **✅ Corrigé** (secret CI toujours manquant, action manuelle) |
| F6 | Écriture/lecture O(arbre entier) à chaque édition — rupture à 10× | **Majeur** (horizon) | **📄 Analysé, non corrigé** — refactor jugé trop risqué sans feu vert explicite (`docs/f6-scalability-analysis.md`) |
| F7 | Route handlers `/api/data/*` sans tests 401/403/happy-path | Mineur | **✅ Traité (volet 401)** — 403/happy-path en gap documenté (`SUPABASE_TEST_*` manquant) |
| F8 | Canaux/routes annexes sur tables Supabase mortes (`subscribeComments`, `/api/export-pdf`, notify-join, send-approval-email) | Mineur | **✅ Corrigé** (sauf `subscribeComments`, documenté comme inerte — pas de correctif, portée plus large) |
| F9 | Rollback Storage partiellement fictif ; domaine `pub-*.r2.dev` en prod | Mineur | **📄 Documenté**, non exécutable par un agent (dashboard Cloudflare requis) |
| F10 | CLAUDE.md : 5 dérives état-courant vs code (palette, rate-limit, AUDIT-V4, compte de specs, promesse rollback) | Mineur | **✅ Corrigé** |
| F11 | `Person` mobile sans `media`/`photoTags`, parité non testée | Mineur | **✅ Corrigé** (test de parité pure-logic) |
| F12 | `server-only` partiel (3 fichiers sur ~8 concernés) ; partage éclaté dans `supabaseSync.ts` (cause racine de F1) | Mineur | **✅ Vérifié** — ne peut pas être complété sans casser des tests existants (documenté) |
| F13 | Code mort (`fetchMembers`), commentaire périmé (`railwayStore.ts:438-440`), `sharedByName` en dur | Observation | **✅ Partiellement traité** (code mort retiré, commentaire corrigé ; `sharedByName` laissé en l'état) |
| F14 | Double système migrations Supabase, synchronisé mais manuel | Observation | **✅ Corrigé** (bandeau « historique » sur les 16 miroirs) |

**Bilan (2026-07-16, soir) : 5 des 6 Majeurs corrigés (F6 analysé mais pas corrigé, en attente de feu vert) ; 5 des 6 Mineurs traités (F7 volet 401 fait, volet 403/happy-path en gap documenté ; F9 documenté mais bloqué sur un accès externe) ; 3 des 3 Observations traitées (F13 partiel, F14 fait, garde-fou d'inventaire posé).**

## Recommandations priorisées — état (2026-07-16, soir)

1. ~~**Corriger F2 (invitation anonyme) en premier**~~ **✅ Fait.**
2. ~~**Corriger F1 (partage email/public)**~~ **✅ Fait**, y compris l'endpoint public `/api/data/trees/[id]/public`.
3. ~~**Requalifier le rollback (F3)**~~ **✅ Fait**, script de copie inverse écrit et testé (mocké).
4. ~~**Poser le garde-fou d'inventaire de frontière**~~ **✅ Fait** — `e2e/frontier-inventory.spec.ts`, vérifié en injectant une violation réelle puis en confirmant l'échec.
5. ~~**Fermer le risque AuthZ (F4) + migrations Railway (F5)**~~ **✅ Fait** pour la partie code (test de parité + framework de migrations) ; **le secret `RAILWAY_TEST_DATABASE_URL`/`RAILWAY_DATABASE_URL_UNPOOLED` reste à poser côté GitHub Secrets** (accès manuel requis, hors de portée d'un agent).
6. ~~**F7 (tests 401 des route handlers)**~~ **✅ Fait** — `e2e/api-data-authn.spec.ts` ; le volet 403/happy-path reste un gap documenté (credentials de test absentes).
7. ~~**F14 (gel officiel des miroirs Supabase)**~~ **✅ Fait** — bandeau sur les 16 fichiers concernés.

**Restent ouverts** : le volet 403/happy-path de F7 (nécessite `SUPABASE_TEST_*`, hors de portée de cet environnement), et F6 au-delà de l'analyse écrite (attend un feu vert explicite avant tout code, cf. `docs/f6-scalability-analysis.md`). F9 reste bloqué sur un accès dashboard Cloudflare que l'agent n'a pas.
