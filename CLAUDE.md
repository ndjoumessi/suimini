# CLAUDE.md

Guide pour travailler dans **Suimini** — application web d'arbre généalogique (FR/EN), collaborative et élégante.

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
                       #   /arbre/[slug] (partage public lecture seule), /cgu,
                       #   /confidentialite, /auth/*. API: /api/narrative (Anthropic),
                       #   /api/send-approval (Resend). sitemap.ts, robots.ts.
    layout.tsx         # <html lang>, polices next/font, NextIntlClientProvider, preconnects
    globals.css        # SYSTÈME DE DESIGN "Atelier" (variables CSS + classes utilitaires)
  proxy.ts             # Garde d'auth Next 16 (PAS middleware.ts) — protège /app
  components/          # ~38 composants. SuiminiApp.tsx orchestre l'app connectée.
    landing/Landing.tsx
  hooks/               # useAuth, useFamilyStore, useAdminData, useTheme, useDarkMode…
  lib/                 # supabase.ts, supabaseSync.ts, treeUtils.ts, sampleData.ts, emails.ts…
  i18n/                # config.ts (constantes) + request.ts (locale depuis cookie)
messages/              # fr.json + en.json
supabase/              # schema.sql + migrations manuelles (share-public.sql, storage.sql…)
e2e/                   # tests Playwright
```

### Auth & multitenant
- `src/proxy.ts` (convention **`proxy`** de Next 16, le `middleware` est déprécié) protège `/app` : nécessite une session Supabase **ou** le cookie démo, et un statut `approved` (sinon redirige vers `/`).
- `useAuth` (`src/hooks/useAuth.ts`) expose `user`, `isDemo`, `signIn`, `signUp`, `startDemo`, etc.
- Statuts de compte : `pending | approved | rejected | suspended` ; rôles : `user | admin | superadmin`.

### Données (arbres)
- `useFamilyStore` : source de vérité. Persiste en **localStorage** et synchronise avec **Supabase** quand connecté. Seede toujours l'arbre d'exemple **« Famille Dupont » (`tree1`)** pour les invités/démo.
- `lib/supabaseSync.ts` : mappage lignes ↔ objets, chargement/sauvegarde, partage (`shareTree`, `setTreePublic`, `loadPublicTree`).
- Schéma SQL dans `supabase/schema.sql` ; **les migrations s'exécutent manuellement** dans le SQL editor Supabase (ex. `supabase/share-public.sql`).

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

## Variables d'environnement

`.env.local` (non committé) et secrets Vercel :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (auth/données)
- `ANTHROPIC_API_KEY` (rapport narratif IA, server-only)
- `RESEND_API_KEY` (email d'approbation, server-only)

Sans les vars Supabase, l'app tourne en mode invité (localStorage).

## Tests & CI

- `e2e/` : `smoke.spec.ts`, `demo-flow.spec.ts`, `dashboard-screenshot.spec.ts`.
- `playwright.config.ts` : bloque le **service worker** (`serviceWorkers: 'block'`) — sinon un SW périmé casse les `reload()` en test. `E2E_BASE_URL` permet de viser un serveur déjà lancé (sinon un `npm run dev` est démarré).
- `.github/workflows/ci.yml` : jobs `build` (npm ci → tsc → build) puis `e2e` (build → `next start` → smoke tests). Actions épinglées en `@v6` (Node 24). Les secrets Supabase/Anthropic/Resend doivent exister côté repo GitHub.

## Pièges connus (à respecter)

- **`onAuthStateChange` doit rester synchrone** (`useAuth.ts`) : ne jamais `await` un appel Supabase dedans → deadlock GoTrue (le login reste bloqué sur « Connexion en cours… »). Différer via `setTimeout(0)`.
- **Committer `package.json` + `package-lock.json` ensemble** quand on ajoute une dépendance : sinon `npm ci` en CI/Vercel échoue (ex. oubli de `@playwright/test` / `next-intl`).
- Routes sous `app/_xxx/` = **privées** (non routables) ; ne pas s'en servir pour des pages réelles.
- `tsconfig.tsbuildinfo` est tracké (cache incrémental) ; en cas de tsc capricieux après suppression de routes, `rm -rf .next` puis rebuild.
- Partage public (`/arbre/[slug]`) : `force-dynamic` + RLS qui masque les fiches « privé » et n'expose jamais le journal. Migration : `supabase/share-public.sql` (manuelle).

## Conventions

- Commits en français, style `type: résumé` (`feat:`, `fix:`, `chore:`). Terminer par `Co-Authored-By: Claude …`.
- Travailler sur `main` (l'historique du repo est direct-sur-main). Pousser puis `vercel --prod` quand demandé.
- Préférer les styles inline + variables CSS du design system ; matcher le style du code environnant.
