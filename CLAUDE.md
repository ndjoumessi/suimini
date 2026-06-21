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
  i18n/                # config.ts (constantes) + request.ts (locale depuis cookie)
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
- Arbre **famille TEDA** (`teda1`) : scripts SQL dans `supabase/teda/` (seed, enrichissement, branche étendue…). Le **PDF de synthèse** est généré depuis `supabase/teda/pdf/teda_v2.html` (HTML « Atelier » autonome) via `render.mjs` (rendu Chromium/Playwright, Node 22) — voir `supabase/teda/pdf/README.md`.

### Export PDF (« Livret de famille ») & responsive mobile
- **Deux chemins PDF, tous deux côté navigateur** (⚠️ Playwright/Chromium ne tourne PAS dans une route API Vercel) :
  - `PrintModal.tsx` : impression livret/list/cards/summary via `window.open` + `print()`, et export *image* de l'arbre via `jspdf` + `html2canvas`.
  - `ExportPDFModal.tsx` + `lib/pdfTemplates.ts` (`generateFamilyBookHTML`) : livret officiel (couverture, sommaire, fiches par génération, index A-Z), 3 thèmes × 3 formats (A4/A5/Letter), ouvert dans une fenêtre d'impression. `/api/export-pdf` renvoie le même HTML (endpoint secondaire). Styles **inline + hex littéraux** (la fenêtre d'impression n'a ni nos classes ni nos `var()`).
- **Mobile** : `useMediaQuery` / `useIsMobile` (≤767px). En dessous, la sidebar est masquée au profit de `BottomNav.tsx`, et `PersonPanel` s'ouvre en bottom-sheet plein écran.

### Emails (Resend, server-only)
- Contenu HTML dans `lib/emails.ts` (Atelier, table-based, hex littéraux, fallback Georgia). Routes : `/api/send-approval` (compte activé), `/api/send-invite-email` (invitation membre), `/api/send-approval-email` (notifie le **propriétaire** quand un membre accepte — hook *best-effort* dans `acceptInvitation` de `lib/sharing.ts`, couvre les deux chemins d'acceptation : bouton explicite ET auto-accept post-login).
- ⚠️ **RLS** : un user ne lit que **son** profil (`profiles_select using (id = auth.uid())`). Pour lire l'email/`display_name` d'un pair (ex. le propriétaire), passer par la RPC SECURITY DEFINER **`get_public_profiles(ids uuid[])`** — jamais un `select` direct sur `profiles`. NB : `profiles` a `display_name` (pas `first_name`/`last_name`).
- Toutes les routes email **no-op gracieusement** (`200 { skipped }`) sans `RESEND_API_KEY`.

### i18n (next-intl, sans routing URL)
- Mode **"without i18n routing"** : la locale vient du **cookie `NEXT_LOCALE`** (+ localStorage), **pas de l'URL** (pas de `/en`). `app/` n'est PAS restructuré.
- `src/i18n/request.ts` lit le cookie (défaut `fr`). `LanguageSwitcher.tsx` écrit le cookie + recharge.
- Chaînes dans `messages/{fr,en}.json`. Composants : `useTranslations('namespace')`.
- Lire un cookie dans le layout rend `/` **dynamique** (`ƒ`) — c'est voulu (la locale est honorée par requête).

## Design — système « Atelier »

Brutalisme raffiné. **Pas de classes utilitaires Tailwind** en pratique : on utilise des **styles inline + des variables CSS et classes définies dans `globals.css`**.

- Polices (via `next/font`) : **Bricolage Grotesque** (`--font-display`), **Hanken Grotesk** (`--font-body`), **IBM Plex Mono** (`--font-mono`). ⚠️ Ne PAS introduire Space Grotesk / Inter / Arial.
- Variables clés : `--ink`, `--accent` (terracotta `#bf4b2c`), `--bg`, `--bg-card`, `--border-strong`, `--bw` (épaisseur de bordure), `--shadow` (`4px 4px 0`).
- Classes utiles : `.card`, `.btn` / `.btn-primary` / `.btn-secondary`, `.label` (mono uppercase), `.serif`, `.mono`, `.input`.
- Cards : bordure `var(--bw) solid var(--border-strong)` + `box-shadow: var(--shadow)`. Chiffres mis en avant en terracotta.
- Avant tout travail UI, lire `~/.claude/skills/frontend-design/SKILL.md`.

## Mobile (`mobile/` — React Native / Expo)

App native compagnon (iOS/Android), même design « Atelier » que le web. **Projet séparé** avec son propre `package.json`/`node_modules`/`tsconfig` — toujours travailler **dans `mobile/`** (cd) et garder Node 22.

- **Stack** : **Expo SDK 54** (RN 0.81, React 19) · **Expo Router 6** (file-based, typed routes) · `react-native-svg` (arbre pan/pinch via `react-native-gesture-handler` + `react-native-reanimated` v4 — plugin babel `react-native-worklets/plugin`) · **Zustand + MMKV** (store/persistance) · **i18next + react-i18next + expo-localization** (FR/EN) · `@react-native-community/datetimepicker` · `expo-notifications` (+ `expo-device`) · `lucide-react-native`.
- **Projet EAS** : `@ndjoumessi/suimini` (`extra.eas.projectId` dans `app.json`) — requis pour les Expo Push Tokens.
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
- **i18n** : `lib/i18n.ts` (langue = choix persisté MMKV > langue du téléphone > `fr`). Chaînes dans `mobile/locales/{fr,en}.ts` (`en` typé sur `fr` → parité). Tout texte UI passe par `t('clé')` ; toggle FR/EN dans `settings.tsx`. **Distinct du web** (qui utilise `next-intl` + `messages/`).
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
- **Committer `package.json` + `package-lock.json` ensemble** quand on ajoute une dépendance : sinon `npm ci` en CI/Vercel échoue (ex. oubli de `@playwright/test` / `next-intl`).
- Routes sous `app/_xxx/` = **privées** (non routables) ; ne pas s'en servir pour des pages réelles.
- `tsconfig.tsbuildinfo` est tracké (cache incrémental) ; en cas de tsc capricieux après suppression de routes, `rm -rf .next` puis rebuild.
- Partage public (`/arbre/[slug]`) : `force-dynamic` + RLS qui masque les fiches « privé » et n'expose jamais le journal. Migration : `supabase/share-public.sql` (manuelle).
- **PDF = navigateur, pas serveur** : `playwright`/Chromium ne tourne pas dans une route API Vercel (`@playwright/test` n'est qu'une *devDependency* pour `render.mjs` local + e2e). Générer le PDF côté client via fenêtre d'impression (`pdfTemplates.ts` / `PrintModal`), pas dans `/api/*`.
- **Lecture d'un profil tiers** : RLS bloque le `select` direct sur `profiles` d'un autre user → utiliser la RPC `get_public_profiles(ids)` (voir section Emails).
- **Web ≠ mobile** : deux projets, deux i18n (`next-intl`+`messages/` vs `i18next`+`mobile/locales/`), deux `useAuth`/`useFamilyStore`. Ne pas importer de l'un vers l'autre ; le modèle (`Person`/`Tree`) est **dupliqué** dans `mobile/lib/types.ts` (garder en phase). Vérifier `tsc`/`expo export` **dans `mobile/`** séparément du `tsc`/`build` racine.
- **Écriture prod bloquée depuis l'agent** : sans `service_role` key / mot de passe DB (absents partout), impossible d'exécuter un `supabase/*.sql` contre la prod — livrer le script et demander à l'utilisateur de le lancer dans le SQL Editor.

## Conventions

- Commits en français, style `type: résumé` (`feat:`, `fix:`, `chore:`). Terminer par `Co-Authored-By: Claude …`.
- Travailler sur `main` (l'historique du repo est direct-sur-main). Pousser puis `vercel --prod` quand demandé.
- Préférer les styles inline + variables CSS du design system ; matcher le style du code environnant.
