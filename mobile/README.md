# Suimini Mobile

Application mobile **React Native / Expo** pour Suimini — l'arbre généalogique
collaboratif et élégant (FR). Porte le système de design **« Atelier »** (warm
brutalism : toile bone, règles encre, accent terracotta, ombres dures décalées)
sur iOS et Android.

## Stack

- **Expo SDK 52** + **Expo Router 4** (navigation file-based, typed routes)
- **React Native SVG** — arbre interactif (pan + pinch via Gesture Handler / Reanimated)
- **Supabase** (`@supabase/supabase-js`) — auth + données ; **fallback démo** hors-ligne
- **Zustand** + **MMKV** — store famille et persistance locale rapide
- **@expo-google-fonts** — Bricolage Grotesque · Hanken Grotesk · IBM Plex Mono
- **lucide-react-native** — icônes

Le modèle de données (`lib/types.ts`) et le mapping Supabase (`lib/supabaseSync.ts`)
sont **calqués sur le web** (`src/types`, `src/lib/data/supabaseSync.ts`) : même schéma
de colonnes, mêmes objets `Person` / `Relationship` / `FamilyTree`.

## Setup

> ⚠️ Node 22 recommandé (comme le projet web) : `source ~/.nvm/nvm.sh && nvm use 22`

```bash
cd mobile
npm install
cp .env.example .env.local        # ou .env
# Renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
#   (mêmes valeurs que NEXT_PUBLIC_* du web). Sans elles → mode démo.
npm start                          # puis i (iOS), a (Android), ou QR Expo Go
```

> MMKV et Reanimated nécessitent un **dev client** ou un build natif — Expo Go
> récent (SDK 52) embarque ces modules. En cas de souci, `npx expo prebuild`
> puis `npx expo run:ios` / `run:android`.

## Scripts

```bash
npm start            # expo start (Metro)
npm run ios          # ouvre le simulateur iOS
npm run android      # ouvre l'émulateur Android
npm run typecheck    # tsc --noEmit
npm run build:ios    # eas build --platform ios
npm run build:android
```

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase (= `NEXT_PUBLIC_SUPABASE_URL`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé anonyme (= `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |

Les variables `EXPO_PUBLIC_*` sont inlinées dans le bundle (publiques par
design — n'y mettez jamais de secret serveur).

## Structure

```
mobile/
├── app/                     # Expo Router (file-based)
│   ├── _layout.tsx          # Root : fonts, thème, GestureHandler, AuthGate
│   ├── index.tsx            # Redirige vers /(tabs)/home ou /(auth)/login
│   ├── (auth)/              # login.tsx · register.tsx
│   ├── (tabs)/              # home · tree · people · timeline · settings
│   └── person/[id].tsx      # Fiche personne
├── components/
│   ├── ui/                  # Button · Card · Avatar · Badge · Input · EmptyState
│   ├── tree/                # TreeView (SVG pan/pinch) · PersonNode
│   ├── person/              # PersonCard · PersonDetail
│   └── layout/              # Header · TabBar (barre Atelier custom)
├── lib/
│   ├── theme.ts             # Tokens Atelier (couleurs, fonts, ombres, spacing)
│   ├── types.ts             # Modèle partagé (calqué sur le web)
│   ├── supabase.ts          # Client Supabase (null si non configuré → démo)
│   ├── supabaseSync.ts      # Mappers lignes ↔ objets + chargement des arbres
│   ├── store.ts             # Store Zustand (MMKV) — seed « Famille Dupont »
│   ├── sampleData.ts        # Arbre de démo (tree1)
│   ├── treeUtils.ts         # Généalogie : parents, stats, anniversaires…
│   └── treeLayout.ts        # Layout générationnel de l'arbre SVG
├── hooks/                   # useAuth · useFamilyStore · useTheme (+ useAppFonts)
└── assets/                  # images (icône, splash) · fonts (chargées via google-fonts)
```

## Écrans

- **Accueil** — salutation, carte de l'arbre actif, stats, accès rapide,
  anniversaires du mois, dernières fiches (pull-to-refresh).
- **Arbre** — canvas SVG générationnel ; glisser pour naviguer, pincer pour
  zoomer, toucher un nœud ouvre la fiche.
- **Famille** — liste recherchable et triable (nom / naissance / génération),
  pagination 50 par page.
- **Chrono** — frise des événements groupés par décennie.
- **Réglages** — thème (système / clair / sombre), arbre actif, état de sync,
  déconnexion.

## Design « Atelier »

Tokens dans `lib/theme.ts`, miroir de `src/app/globals.css` du web :
bordures `1.5px` encre, ombres dures `3px 3px 0`, rayons ~0, accent terracotta
`#bf4b2c`, polices Bricolage / Hanken / IBM Plex Mono. Mode sombre « Atelier
nuit » inclus, piloté par `useTheme()`.

## Limites connues

- **Écriture** : la v1 charge les arbres (lecture) ; la création/édition de
  fiches reste sur le web. `store.ts` expose déjà `upsertPerson` / `removePerson`
  pour brancher la synchro montante.
- L'arbre SVG utilise un **layout générationnel simple** (pas d'algorithme de
  non-chevauchement type Reingold-Tilford) — suffisant pour les arbres familiaux
  courants.
- Les avatars `dicebear` (SVG distant) tombent en **initiales** : RN `<Image>`
  ne rend pas le SVG distant.
