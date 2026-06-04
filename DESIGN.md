---
name: Suimini
description: Arbre généalogique — "Atelier", brutalisme chaleureux contemporain
colors:
  accent: "#bf4b2c"
  accent-hover: "#a53e22"
  accent-light: "#f6e1d8"
  bg: "#f4f1ea"
  surface-card: "#ffffff"
  surface-muted: "#ece7dc"
  ink: "#1b1b1b"
  ink-muted: "#4a4742"
  ink-light: "#6e6a62"
  border: "#d8d2c6"
  border-strong: "#1b1b1b"
  male: "#2c5f8a"
  female: "#a8456b"
  deceased: "#6e6a62"
  success: "#0e6e63"
  danger: "#9e2b25"
  warning: "#c77d1a"
  info: "#2c5f8a"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.12
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.8px"
rounded:
  sm: "0px"
  md: "2px"
  lg: "4px"
  xl: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
shadow:
  sm: "2px 2px 0 rgba(27,22,18,0.16)"
  md: "4px 4px 0 rgba(27,22,18,0.9)"
  lg: "6px 6px 0 rgba(27,22,18,0.9)"
  xl: "10px 10px 0 rgba(27,22,18,0.9)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    border: "1.5px solid {colors.border-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    border: "1.5px solid {colors.border-strong}"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    border: "1.5px solid {colors.border-strong}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface-card}"
    border: "1.5px solid {colors.border-strong}"
    rounded: "{rounded.md}"
  badge:
    rounded: "{rounded.md}"
    fontFamily: "JetBrains Mono, monospace"
---

# Design System: Suimini — "Atelier"

## 1. Overview

**Creative North Star: "L'Atelier" — le brutalisme chaleureux.**

Suimini se manipule comme un atelier de construction d'histoire familiale : une
grande feuille de papier os (bone) quadrillée, des règles d'encre franches, un
seul accent terre-cuite, et des blocs tactiles qui se soulèvent avec une ombre
portée nette. Le système est structurel et confiant — la hiérarchie se lit dans
le tracé épais des bordures, l'échelle des titres et les libellés en monospace,
pas dans l'ornement. C'est contemporain, un peu brut, mais jamais froid : la
chaleur vient du papier crème, de la terre-cuite et de la générosité des espaces.

Cette identité remplace l'ancien « Album de Famille Relié » (papier crème,
taupe, Playfair/Lato). On garde l'âme chaleureuse et patrimoniale, on change la
voix : plus affirmée, plus moderne, plus structurée.

**Key Characteristics:**
- Papier os (#f4f1ea) + encre franche (#1b1b1b) + accent terre-cuite (#bf4b2c), rare.
- Display géométrique gras (Space Grotesk), corps neutre (Inter), libellés mono (JetBrains Mono, MAJUSCULES).
- Coins nets (rayon 2px), bordures épaisses (1,5px), **ombres portées dures** (`4px 4px 0`).
- Plat au repos ; l'ombre dure répond à l'état (hover/sélection/modale).
- Clair / sombre de plein droit, contrastes tunés ≥ 4.5:1.

## 2. Colors

Neutres chauds (os, lin, encre) sur lesquels un seul accent terre-cuite porte
l'action et le lien ; genre et statut restent des signaux de lecture.

### Primary
- **Terre-cuite** (#bf4b2c, hover #a53e22) : action et lien — boutons primaires,
  onglets actifs, focus, points de timeline, badges accent. En dark → #e0623e.
  Rare par principe (≤ ~10 % d'un écran).
- **Lueur terre-cuite** (#f6e1d8) : halo de focus, fond des badges accent. Dark : #2e211b.

### Neutral
- **Papier os** (#f4f1ea, dark #161412) : fond. **Vélin** (#ffffff, dark #211e1a) :
  cartes, panneaux, champs. **Lin** (#ece7dc, dark #2a2620) : zones inertes.
- **Encre** (#1b1b1b, dark #f4f1ea) : texte principal et règles structurelles.
- **Encre estompée** (#4a4742, ≥ 4.5:1) / **Encre claire** (#6e6a62, ≥ 3:1).
- **Filet** (#d8d2c6, dark #36312a) : séparateurs discrets. **Filet fort**
  (#1b1b1b, dark #7b7264) : contours de cartes / boutons / champs.

### Tertiary (signaux, non décoratifs)
- **Bleu** (#2c5f8a) masculin/info · **Rose** (#a8456b) féminin · **Gris** (#6e6a62) défunt.
- **Vert** (#0e6e63) succès · **Rouge** (#9e2b25) danger · **Ocre** (#c77d1a) avertissement.

### Named Rules
**The Rare Accent Rule.** La terre-cuite est réservée à l'action et au lien ;
jamais un fond large ni un décor. **The Two-Border Rule.** Deux niveaux de trait :
le *filet fort* (encre, 1,5px) cadre les éléments porteurs (cartes, boutons,
champs) ; le *filet* (discret) ne fait que séparer. **The Signal-Not-Decor
Rule.** Bleu/rose/vert/rouge informent (genre, statut, état) — jamais pour égayer.

## 3. Typography

**Display:** Space Grotesk (700) — géométrique, contemporaine, gravée.
**Body:** Inter. **Labels:** JetBrains Mono (MAJUSCULES, +0,8px).

### Hierarchy
- **H1** (Space Grotesk 700, 2.25rem, 1.05, -0.02em) : titre d'écran.
- **H2 / H3** (Space Grotesk 700) : sections, titres de cartes.
- **Body** (Inter 400, 14px, 1.6) : corps ; prose ≤ 65–75ch.
- **Label / `.label`** (JetBrains Mono 700, 11px, MAJ) : éyebrows, dates, légendes,
  compteurs, en-têtes de groupe (≤ 4 mots).

### Named Rules
**The Mono-Caps Rule.** Les MAJUSCULES tracées appartiennent au monospace
(`.label`), pas au display ni au corps. **The Display-for-Headings Rule.** Space
Grotesk pour ce qu'on grave (titres, noms, chiffres clés) ; Inter pour ce qu'on lit.
La classe legacy `.serif` est conservée mais mappée sur le display Space Grotesk.

## 4. Elevation

Système **dur & franc** : surfaces plates au repos, cadrées par le filet fort.
La profondeur naît de l'**ombre portée dure** (offset net, pas de flou) qui
n'apparaît qu'en réponse à un état.

### Shadow Vocabulary
- **Repos** : pas d'ombre — seul le filet fort cadre la carte.
- **Survol / sélection** (`box-shadow: 4px 4px 0 var(--shadow-color)` + `translate(-2px,-2px)`) :
  boutons, cartes interactives, sélecteur d'arbre.
- **Prise de focus** (`6px 6px 0`) : menus, toasts. **Modale** (`10px 10px 0`).
- En dark, l'offset passe sur du noir pur (`rgba(0,0,0,0.85)`).

### Named Rule
**The Flat-At-Rest Rule.** Tout est plat au repos ; l'ombre dure est une réaction
(hover/focus/modale), jamais un décor permanent.

## 5. Components

Caractère : franc, tactile, lisible. Rayon 2px par défaut, transitions brèves
(150ms) sur `--ease-out`.

- **Boutons** : rayon 2px, bordure encre 1,5px, poids 700. Primaire terre-cuite ;
  hover → `translate(-2px,-2px)` + ombre dure ; `:active` → retour à plat
  (`translate(0,0)` + petite ombre). Secondaire vélin ; ghost sans bordure.
- **Cartes / champs** : vélin, filet fort, coins nets ; champ en focus → bordure
  accent + halo dur `3px 3px 0` en lueur terre-cuite.
- **Onglets** : actif = texte accent + soulignement 3px accent + poids 700.
- **Badges** : rectangulaires (2px), monospace MAJ, bordure 1px. Variantes
  sémantiques pâles (genre/statut/accent), atténuées en dark.
- **Toasts (signature)** : carte vélin, filet fort + ombre dure, **liseré gauche
  6px** coloré par type (succès/erreur/info/avertissement) + icône.
- **Marque** : `src/components/Brand.tsx` (`BrandMark` / `BrandLockup`) — carré
  bordé contenant un glyphe d'arbre minimal (un parent, deux enfants). Remplace
  l'ancienne emoji 🌿.
- **Tree node (signature)** : carré bordé, barre de couleur de genre en signal,
  ombre dure au survol/sélection.

## 6. Do's and Don'ts

### Do
- Garder la terre-cuite rare (action/lien, ≤ 10 %).
- Cadrer cartes/boutons/champs au *filet fort*, séparer au *filet* discret.
- Laisser plat au repos ; n'élever qu'en réaction (ombre dure).
- Space Grotesk pour titres/noms/chiffres, Inter pour le corps, mono pour les libellés.
- Vérifier le contraste (corps ≥ 4.5:1) en clair **et** en dark.
- Respecter `prefers-reduced-motion` (transitions brèves, repli instantané).

### Don't
- Pas de **SaaS générique froid** (bleus corporate en fond, dégradés tech).
- Pas de **gradient text**, pas de coins très arrondis, pas d'ombres floues douces
  (l'ombre est dure et portée).
- Pas d'**emoji comme icône structurelle** : utiliser Lucide (SVG). Quelques
  glyphes de domaine (marqueurs d'événements ✝/✦…) restent typographiques, jamais en chrome d'UI.
- Pas d'étalement des couleurs de genre/statut comme accents décoratifs.
- Pas de phrases en MAJUSCULES (réservées au `.label` mono, ≤ 4 mots).

---

## Implementation notes

- Source de vérité : `src/app/globals.css` (tokens CSS + primitives `.btn .card
  .input .tab .badge .toast .modal .icon-btn`). Les noms de variables/classes sont
  stables : le système se propage à toute l'app.
- Miroir JS : `src/lib/tokens.ts`. Thèmes de couleur (6, terre-cuite par défaut) :
  `src/lib/themes.ts` — surchargent `--accent/--male/--female`, dark-aware.
- Build/dev : Node 22 (`nvm use 22`).
