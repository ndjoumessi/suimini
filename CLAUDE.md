# CLAUDE.md

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
npx tsc --noEmit     # type-check seul
npm run test:e2e     # Playwright (e2e/)
vercel --prod --yes  # déploiement production
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
    layout.tsx         # <html lang>, polices next/font, NextIntlClientProvider, preconnects
    globals.css        # SYSTÈME DE DESIGN "Atelier" (variables CSS + classes utilitaires)
  proxy.ts             # Garde d'auth Next 16 (PAS middleware.ts) — protège /app
  components/          # ~40 composants. SuiminiApp.tsx orchestre l'app connectée
                       #   (Sidebar desktop, BottomNav mobile, PrintModal, ExportPDFModal…).
    landing/Landing.tsx
  hooks/               # useAuth, useFamilyStore, useAdminData, useTheme, useDarkMode, useMediaQuery…
  lib/                 # supabase.ts, supabaseSync.ts, treeUtils.ts, sampleData.ts,
                       #   emails.ts, sharing.ts, pdfTemplates.ts…
  i18n/                # config.ts (constantes) + request.ts (locale SSR depuis cookie)
                       #   + messages.ts (bundle fr+en → bascule instantanée via IntlProvider)
messages/              # fr.json + en.json
supabase/              # schema.sql + migrations manuelles (share-public.sql, storage.sql,
                       #   push-tokens.sql, cleanup-demo-tree.sql…)
  teda/                # scripts SQL de l'arbre famille TEDA (seed, enrichissement,
                       #   update-teda-v2-final.sql…) ; pdf/ = sources du PDF de synthèse
mobile/                # App React Native / Expo (SDK 54) — voir section « Mobile »
e2e/                   # tests Playwright
```

> ⚠️ Le **root `tsconfig.json` exclut `mobile`** (`exclude: ["node_modules","mobile"]`) : le projet RN a son propre `tsconfig`/`node_modules`. Sans ça, `tsc`/`next build` au root planteraient sur les fichiers `mobile/`.

### Auth & multitenant
- `src/proxy.ts` (convention **`proxy`** de Next 16, le `middleware` est déprécié) protège `/app` : nécessite une session Supabase **ou** le cookie démo, et un statut `approved` (sinon redirige vers `/`).
- `useAuth` (`src/hooks/useAuth.ts`) expose `user`, `isDemo`, `signIn`, `signUp`, `startDemo`, etc.
- Statuts de compte : `pending | approved | rejected | suspended` ; rôles : `user | admin | superadmin`.

### Données (arbres)
- `useFamilyStore` : source de vérité. Persiste en **localStorage** et synchronise avec **Supabase** quand connecté. Seede toujours l'arbre d'exemple **« Famille Dupont » (`tree1`)** pour les invités/démo.
- `lib/supabaseSync.ts` : mappage lignes ↔ objets, chargement/sauvegarde, partage (`shareTree`, `setTreePublic`, `loadPublicTree`).
- Schéma SQL dans `supabase/schema.sql` ; **les migrations s'exécutent manuellement** dans le SQL editor Supabase (ex. `supabase/share-public.sql`).
- Arbre **famille TEDA** (`teda1`) : scripts SQL dans `supabase/teda/`. **État de référence = 57 personnes / 93 relations**, restauré depuis l'export applicatif via **`RESTORE_TEDA_FROM_EXPORT.sql`** (source de vérité ; max `teda-p58` / `teda-r94`). `update-teda-djoumessi-family.sql` ajoute la famille de DJOUMESSI Mathias (→ 71/119). ⚠️ **Convention de noms TEDA** : `first_name` = **NOM de famille**, `last_name` = **prénom** (ex. `('DJOUMESSI','Mathias')`, `('TSANA','Sébastien')`). Le **PDF de synthèse** est généré depuis `supabase/teda/pdf/teda_v2.html` (HTML « Atelier » autonome) via `render.mjs` (rendu Chromium/Playwright, Node 22) — voir `supabase/teda/pdf/README.md`.

### Synchronisation Supabase (`supabaseSync.ts` + `useFamilyStore`)
- **Architecture UPSERT-only + soft-delete** (migration `supabase/soft-delete.sql`) : la sync **n'émet JAMAIS de DELETE** sur les tables enfants. Push = `pushChildTable` (upsert pur, `deleted_at: null` → présent localement = vivant, un undo de suppression ranime la tombstone) ; suppression = `deleteChildRows` (UPDATE `deleted_at = now()`) ; lectures filtrent `deleted_at` **côté client** (web `liveRows`, mobile, `/api/export-pdf`) — fonctionne avant ET après migration. Récupération d'urgence : `SET deleted_at = NULL` ; purge : `select * from purge_tombstones()`. **Repli pré-migration** automatique (PGRST204/42703 → upsert sans la colonne, DELETE dur). L'ancien `syncChildTable` (DELETE-par-diff « distant − cache », qui a causé l'incident TEDA + gardes heuristiques cache-vide/<50 %) **n'existe plus**.
- **Mappage lignes ↔ objets** : `rowToPerson`/`rowToRel` étalent le fourre-tout **`extra` EN PREMIER**, puis les colonnes canoniques → les colonnes mappées (`id`, `updated_at`, `birth_place`…) **priment toujours** sur un `extra` pollué (sinon un `updatedAt`/`birthPlace` résiduel écrasait la vraie valeur → tri « Dernières modifications » faussé, lieu perdu). ⚠️ **Un script SQL doit mettre chaque champ dans SA colonne** (lieu → `birth_place jsonb {"city":…}`, PAS dans `extra`) — `extra` = uniquement les champs non normalisés (maidenName, nickName, events…).
- **Écriture** (push cloud débouncé) : CRUD explicite (add/update/delete personne, relation, journal) → flush **immédiat 0 ms** (`immediateSyncRef`) ; `updateTree` en bloc garde **700 ms**. Listener `beforeunload`/`pagehide` vide un push en attente (`pendingPushRef`) avant un F5. Tout passe par **`pushTreeNow`** : (1) diff **« ids affichés puis retirés »** (`knownIdsRef` — jamais un diff contre le distant) pour capter les retraits implicites (undo d'un ajout, fusion) ; (2) rejoue les **suppressions durables** (`suimini_pending_deletes`, localStorage, TTL 7 j — posées au retrait, effacées à la confirmation serveur → un F5 qui coupe le push ne perd jamais une suppression) ; (3) upsert de l'arbre ; (4) mémorise les ids poussés.
- **Suppression** : soft-delete uniquement (voir ci-dessus). `recordDeletedIds` (`suimini_recent_deletes`, 60 s) empêche toujours la résurrection par le merge favor-local. Suppression d'un **arbre** entier = seul DELETE dur restant (action explicite confirmée, cascade FK).
- **Tests de non-régression** : `e2e/sync-logic.spec.ts` (logique pure + faux client Supabase, sans navigateur — vérifie notamment « jamais de DELETE », repli pré-migration, filtrage tombstones, merge). Helpers purs extraits dans `src/lib/syncMerge.ts` (`mergeTreeFavoringLocal`, `treeIdSets`, `removedIds`).
- **Chargement** : le distant **remplace** le cache local (hard-replace). Exceptions : (a) **F5 même session** sur un arbre édité < `FAVOR_LOCAL_MS` (30 s) → `mergeTreeFavoringLocal` garde le local + ajoute les entités distantes manquantes (couvre la latence de commit) ; (b) **login / session fraîche** (flag `sessionStorage suimini_session_loaded`, effacé au `signOut`) → **toujours hard-replace**, jamais de merge. `resync()` et le pull au retour de focus restent des hard-pull.
- **Génération** : `buildGenerationMap(tree)` (`treeUtils`) = numéro de génération **canonique par personne** (BFS depuis la racine, enfant +1 / parent −1 / conjoint = même génération, normalisé). Utilisé par **TreeView, FocusTree ET DashboardView** → un membre a **le même numéro partout**, indépendant du pivot/focus affiché.

### Export PDF (« Livret de famille ») & responsive mobile
- **Deux chemins PDF, tous deux côté navigateur** (⚠️ Playwright/Chromium ne tourne PAS dans une route API Vercel) :
  - `PrintModal.tsx` : impression livret/list/cards/summary via `window.open` + `print()`, et export *image* de l'arbre via `jspdf` + `html2canvas`.
  - **Visual tree** (export image de l'arbre) : layout générique dans `lib/treeLayout.ts` (`buildTreeLayout` — place **toute** personne une fois, bande « unattached » pour les isolés, pivot = `rootPersonId` sinon fondateur le plus prolifique). Le **« spine » (lignée principale)** = chaîne d'ancêtres du pivot (via 1er parent) + descente vers le descendant le **plus profond / récent** (enfant menant à la génération la plus basse, départage par nb de descendants — **pas** « le plus de descendants » seul, qui dévie vers une branche large mais courte). Ses connecteurs sont taggés `parent-main`, rendus **en dernier** (au-dessus des gris) en **ambre `#C9A84C` 2px**. ⚠️ **Pas d'espace blanc** : la `bbox` (`maxY`) part du **bas du dernier nœud** (pas de `y` qui a déjà avancé d'un `V_GAP`), et l'export PDF crée une **page à la hauteur du contenu** (`format: [420, singlePageH]`) au lieu d'A3 figé — pagination A3 seulement si trop haut (`> 297mm`) ou trop large (`scale < 0,4`). `validateVisualTree(tree)` = garde-fou dev (renderedNodes == totalPersons).
  - `ExportPDFModal.tsx` + `lib/pdfTemplates.ts` (`generateFamilyBookHTML`) : livret officiel (couverture, sommaire, fiches par génération, index A-Z), 3 thèmes × 3 formats (A4/A5/Letter), ouvert dans une fenêtre d'impression. `/api/export-pdf` renvoie le même HTML (endpoint secondaire). Styles **inline + hex littéraux** (la fenêtre d'impression n'a ni nos classes ni nos `var()`).
- **Mobile** : `useMediaQuery` / `useIsMobile` (≤767px). En dessous, la sidebar est masquée au profit de `BottomNav.tsx`, et `PersonPanel` s'ouvre en bottom-sheet plein écran.

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

- Polices (via `next/font`, **source de vérité = `src/app/layout.tsx`**) : **Spectral** (`--font-display` : titres, noms, chiffres) · **Plus Jakarta Sans** (`--font-body` : UI / corps / labels) · **IBM Plex Mono** (`--font-mono` : dates, IDs). ⚠️ Ne PAS introduire Inter / Arial / Space Grotesk. (Le commentaire d'en-tête de `globals.css` dit encore « Libre Baskerville » → **périmé**, c'est Plus Jakarta Sans.) La landing (`Landing.tsx`) charge **Spectral seul** (scopé `--lp-serif`).
- Couleurs (dark) : `--bg #111118` · `--bg-card #1e1e28` · `--ink #f5f0e8` · `--accent` **or muted `#c9a84c`** (⚠️ PAS le terracotta `#bf4b2c` de l'ancien thème clair) · `--text-muted #9094a6` (secondaire, ≥4.5:1) · `--text-light #888896` (tertiaire, ≥4.5:1). `--border-strong`, `--bw`, `--shadow`.
- **Zéro border-radius** : toute l'échelle `--radius*` = `0`. Pour les littéraux, mettre `0` — **exception : garder circulaires les vrais cercles** (spinner ring, `input[type=radio]`, points ronds).
- Classes utiles : `.card`, `.btn` / `.btn-primary` / `.btn-secondary`, `.label` (mono uppercase), `.serif`, `.mono`, `.input`.
- Cards : bordure `var(--bw) solid var(--border-strong)` + `box-shadow: var(--shadow)`. Chiffres mis en avant en or.
- Avant tout travail UI, lire `.claude/skills/impeccable/SKILL.md` (`PRODUCT.md` décrit produit/registre). Sous-commandes : `/impeccable polish|audit|critique|craft`. Audit UI/UX de référence : **`AUDIT-V4.md`** (racine).

## Mobile (`mobile/` — React Native / Expo)

App native compagnon (iOS/Android), même design « Atelier » que le web. **Projet séparé** avec son propre `package.json`/`node_modules`/`tsconfig` — toujours travailler **dans `mobile/`** (cd) et garder Node 22.

- **Stack** : **Expo SDK 54** (RN 0.81, React 19) · **Expo Router 6** (file-based, typed routes) · `react-native-svg` (arbre pan/pinch via `react-native-gesture-handler` + `react-native-reanimated` v4 — plugin babel `react-native-worklets/plugin`) · **Zustand + MMKV** (store/persistance) · **i18next + react-i18next + expo-localization** (FR/EN) · `@react-native-community/datetimepicker` · `expo-notifications` (+ `expo-device`) · `lucide-react-native`.
- **Identité app** (`app.json`) : `owner: ndjoumessi`, `ios.bundleIdentifier` / `android.package` = **`com.suimini.app`**, `ios.buildNumber "1"` / `android.versionCode 1`.
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
- **Sync : `extra` vs colonnes + gardes** — voir « Synchronisation Supabase » : `rowToPerson` fait primer les colonnes canoniques (un `updatedAt` dans `extra` casse le tri « Dernières modifications ») ; `syncChildTable` ne purge jamais sur cache vide ; suppression = `deleteChildRows` direct ; login frais = hard-replace (flag `suimini_session_loaded`).

## Conventions

- Commits en français, style `type: résumé` (`feat:`, `fix:`, `chore:`). Terminer par `Co-Authored-By: Claude …`.
- Travailler sur `main` (l'historique du repo est direct-sur-main). Pousser puis `vercel --prod` quand demandé.
- Préférer les styles inline + variables CSS du design system ; matcher le style du code environnant.
- **Tout texte UI passe par `t()`** (next-intl) ; ajouter la clé dans `messages/fr.json` **et** `en.json` (parité). Pas de chaîne en dur (toasts inclus — voir namespaces `toasts.*` / `app.*`).
- **Messages d'erreur actionnables** : format `« {ce qui a échoué} — {action} »` avec un chemin de récupération visible (bouton Réessayer/Retour). Préférer une clé **spécifique au contexte** (ex. `personForm.saveFailed`, `sharing.errGeneric`, `invite.errorTitle`) ; `common.error` (« Une erreur inattendue — Réessayer ») reste le **dernier recours générique**. ⚠️ Ne **pas** i18n-iser `app/error.tsx` / `app/global-error.tsx` (fallbacks volontaires qui doivent rendre même si le provider i18n a planté).
- **Couleurs de genre** : source unique `GENDER_BAR` (`src/components/tree/nodeStyle.ts`) — homme bleu `#4A90D9`, femme rose `#C47BA0`, inconnu `#3A3A4A`. Arbre, liste (`PersonCard`), `PersonAvatar` et exploration la consomment ; l'or `#c9a84c` est réservé au **pivot/fondateur**, jamais au genre.
- **Fiche personne / nœud** : `nameLines` (`nodeStyle.ts`) → `primary` = `firstName` (gras), `secondary` = `lastName` (atténué). **NOM optionnel** : `PersonForm` exige au moins **un** des deux (prénom OU nom) ; `getDisplayName` est null-safe/`trim()` (nom unique type MESSE/TEDA). Le **surnom** (`nickName`) s'affiche en 3ᵉ ligne italique/discrète **sans guillemets** dans **les 3 rendus** : FocusTree (`TreeNode.tsx` + `.ft-nickname`), TreeView « Complète » (SVG, pile centrée), Visual tree PDF (`PrintModal`). ⚠️ Il y a **deux renderers d'arbre** : vue « Focus » = `FocusTree` (HTML), vue « Complète » = SVG dans `TreeView` — modifier les deux.
- **Recherche → nœud** : sélectionner un résultat de la CommandPalette bascule sur la vue Arbre et **recentre** l'arbre sur la personne (prop `navTarget` → `pickRoot` dans `TreeView`, effacé via `onNavConsumed`).
- **Barre undo/redo** (`HistoryIndicator`, vue Arbre seule) : éphémère — apparaît quand l'historique change, **auto-fermeture 4 s**, clic extérieur, démontée à la navigation. L'undo reste au clavier (Cmd/Ctrl+Z).
- **Modales** : utiliser le hook `useOverlay(onClose, { enabled? })` (focus-trap + Esc + verrou de scroll + restauration du focus ; `enabled:false` pour les surfaces non modales — ex. PersonPanel n'est un dialog piégé **que** sur mobile plein écran) ; ne pas réimplémenter à la main. Le composant doit être **monté seulement quand ouvert** (le hook agit au mount). Poser soi-même `role="dialog" aria-modal aria-labelledby` (le hook ne gère que le comportement). Le `:focus-visible` est global dans `globals.css`.
- **Accessibilité (WCAG 2.1 AA — état : 0 violation axe, voir `ACCESSIBILITE_RAPPORT.md`)** : garde-fou `e2e/a11y.spec.ts` (axe-core sur landing + app démo + modales — le faire passer avant commit UI). Réflexes : icône décorative → `aria-hidden` / bouton icône-seule → `aria-label` ; champ → `<label htmlFor>`/`aria-label` (jamais placeholder seul) ; erreurs → `role="alert"` + `aria-describedby` + `aria-invalid` ; toggles → `aria-pressed` ; info jamais portée par la couleur seule (genre dit dans l'aria-label des nœuds, sr-only si besoin) ; `.sr-only` et `.skip-link` existent dans `globals.css` (cible `#main-content` sur chaque `<main>`) ; texte sur or = encre `#0d0d0d` (le blanc échoue à 2.28:1) ; pas de `maximumScale` dans le viewport ; conteneur de toasts = live region permanente (Toast.tsx).
- **Pages légales** (`/cgu`, `/confidentialite`) : composant client partagé `LegalDoc.tsx` + namespaces `cgu.*` / `privacy.*` (rich text via `t.rich` avec tags `<b>`).
