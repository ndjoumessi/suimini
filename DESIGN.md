---
name: Suimini
description: Arbre généalogique élégant et chaleureux pour les familles
colors:
  accent: "#8b6f47"
  accent-hover: "#7a5f3a"
  accent-light: "#f0e8da"
  neutral-bg: "#faf8f5"
  surface-card: "#ffffff"
  surface-muted: "#f4f1ec"
  ink: "#1a1612"
  ink-muted: "#5f5953"
  ink-light: "#847c70"
  border: "#e8e2da"
  male: "#3b6fa0"
  female: "#a05070"
  deceased: "#7a7268"
  success: "#4a7c59"
  danger: "#9c3b3b"
  warning: "#b9772a"
  info: "#3b6fa0"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Lato, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Lato, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.6px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: Suimini

## 1. Overview

**Creative North Star: "L'Album de Famille Relié"**

Suimini se manipule comme un bel album de famille relié : papier crème chaud, cuir
taupe en accent, titres en serif gravée. Le système traite de mémoire et de
filiation, pas de données ; chaque écran doit donner l'impression d'un objet
patrimonial qu'on transmet, posé et durable, jamais d'un tableau de bord jetable.
La densité est calme : de l'air, une hiérarchie nette, des tons chauds maîtrisés.
L'élégance se prouve à l'échelle, quand l'arbre passe de treize à trois cents
personnes sans jamais devenir illisible.

La chaleur vient de la justesse, pas de l'ornement. Une seule famille serif
(Playfair Display) porte les titres comme une gravure ; une humaniste sobre (Lato)
porte le corps. L'accent taupe-bronze est rare et précieux : il marque l'action et
le lien, pas la décoration. Le système rejette explicitement le **SaaS générique
froid** (bleus corporate, dashboards stériles, gradients tech, cartes
interchangeables) : rien ne doit sonner « startup ». Il rejette aussi le logiciel
de généalogie vieillot (interfaces denses et datées), le réseau social ludique
(couleurs criardes, gamification) et le luxe ostentatoire (or clinquant).

Le code-couleur du genre (bleu masculin, rose féminin) et les sémantiques
(vivant / défunt, succès / danger) sont des outils de lecture sobres, jamais des
accents décoratifs : on les pose pour informer, on ne les étale pas.

**Key Characteristics:**
- Papier crème chaud (#faf8f5) + accent cuir taupe (#8b6f47), rare et précieux.
- Serif gravée (Playfair Display) pour les titres, humaniste calme (Lato) pour le corps.
- Surfaces plates au repos ; l'élévation répond à l'état (hover, focus).
- Clair / sombre de plein droit, contrastes tunés ≥ 4.5:1.
- Chaleur par la retenue ; jamais par l'ornement gratuit.

## 2. Colors

Une palette de neutres chauds (papier, lin, encre brune) sur laquelle un seul
accent cuir taupe porte l'action et le lien ; les couleurs de genre et de statut
sont des signaux de lecture, pas des décors.

### Primary
- **Cuir Taupe** (#8b6f47, hover #7a5f3a) : la voix d'action et de lien. Boutons
  primaires, onglets actifs, points de timeline, focus ring, liens accentués. En
  dark il s'éclaircit en bronze (#c4935a) pour tenir le contraste. Rare par
  principe ; sa rareté fait sa valeur.
- **Lueur Taupe** (#f0e8da) : halo de focus des champs (`box-shadow 0 0 0 3px`),
  fond des badges accent, surfaces accentuées discrètes. En dark : #2a2018.

### Neutral
- **Papier Crème** (#faf8f5) : le fond du corps. Chaud sans être beige-sable
  décoratif ; c'est l'identité, pas un défaut AI. En dark : encre profonde #12100e.
- **Vélin Blanc** (#ffffff) : cartes, panneaux, modales, champs. Surface posée sur
  le papier. En dark : #1c1916.
- **Lin Sourd** (#f4f1ec) : boutons secondaires, zones inertes, pistes de
  scrollbar. En dark : #242018.
- **Encre Brune** (#1a1612) : texte principal. Brun-noir, pas noir pur, pour
  rester chaud. En dark : #f0ece5.
- **Encre Estompée** (#5f5953, ≥ 4.5:1) : texte secondaire, libellés. **Encre
  Claire** (#847c70, ≥ 3:1) : placeholders, méta tertiaire seulement.
- **Trait de Reliure** (#e8e2da) : bordures, filets, séparateurs. En dark : #3a342c.

### Tertiary (signaux de lecture, non décoratifs)
- **Bleu Filiation** (#3b6fa0) : masculin ; sert aussi d'info. **Rose Filiation**
  (#a05070) : féminin. **Gris Défunt** (#7a7268) : statut décédé.
- **Vert Acte** (#4a7c59, succès), **Rouge Acte** (#9c3b3b, danger),
  **Ocre Acte** (#b9772a, avertissement) : feedback d'état uniquement.

### Named Rules
**The Rare Accent Rule.** Le cuir taupe est réservé à l'action et au lien. Il ne
couvre jamais plus de ~10 % d'un écran. S'il devient un fond large ou un décor, le
système a échoué : sa rareté est le sujet.

**The Signal-Not-Decor Rule.** Bleu/rose/vert/rouge sont des informations (genre,
statut, état d'acte). Interdits comme accents esthétiques : on les pose pour dire
quelque chose, jamais pour « égayer ».

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif)
**Body Font:** Lato (with sans-serif système)

**Character:** Une serif à fort contraste, gravée et patrimoniale, posée sur une
humaniste calme et lisible. Le contraste serif/sans porte toute la hiérarchie ;
aucune troisième famille. C'est l'axe « album relié » : titres comme une
inscription, texte comme une page.

### Hierarchy
- **Display / H1** (Playfair 600, 2rem, 1.2): titre d'écran, en-tête de fiche.
- **Headline / H2** (Playfair 600, 1.5rem, 1.25): sections majeures.
- **Title / H3** (Playfair 600, 1.2rem, 1.3): sous-sections, titres de cartes.
- **Body** (Lato 400, 14px, 1.6): corps de l'interface. Garder les lignes de
  prose longue ≤ 65–75ch.
- **Label** (Lato 700, 11px, +0.6px, MAJUSCULES): éyebrows de champ, légendes,
  en-têtes de groupe. Réservé aux libellés courts (≤ 4 mots).

### Named Rules
**The Two-Voice Rule.** Playfair pour ce qu'on grave (titres, noms), Lato pour ce
qu'on lit (tout le reste). Jamais une troisième famille ; jamais Playfair en
corps, jamais Lato en grand titre.

**The Quiet Caps Rule.** Les MAJUSCULES tracées sont réservées au style `.label`
(11px, ≤ 4 mots). Aucune phrase, aucun corps en capitales.

## 4. Elevation

Système **raffiné & retenu** : les surfaces sont plates au repos, l'ombre est une
réponse à l'état, pas un décor permanent. La profondeur vient d'abord du tracé des
bordures (#e8e2da) et du léger contraste de tons (papier → vélin) ; l'ombre douce
ne fait que poser cartes et panneaux sur la page. Au survol, le primaire se
soulève de 1px avec une ombre teintée ; les modales montent franchement pour
signaler la prise de focus.

### Shadow Vocabulary
- **Repos posé** (`box-shadow: 0 2px 12px rgba(26,22,18,0.08)`) : cartes, panneaux.
- **Détail léger** (`0 1px 2px rgba(26,22,18,0.06)`) : séparations subtiles.
- **Prise de focus** (`0 8px 32px rgba(26,22,18,0.12)`) : modales, toasts, menus.
- **Survol primaire** (`0 4px 12px rgba(139,111,71,0.3)`) : seul l'accent teinte
  son ombre ; réservé au bouton primaire au hover.
- En dark, les mêmes rôles passent à `rgba(0,0,0,0.3 → 0.7)`.

### Named Rules
**The Flat-At-Rest Rule.** Tout est plat au repos. L'ombre n'apparaît que pour
répondre à un état (hover, focus, élévation de modale). Une carte qui « flotte »
sans raison est trop lourde : c'est le tell du logiciel daté.

## 5. Components

Caractère général : posé, lisible, retenu. Rayon doux (8px) par défaut, transitions
brèves (150–200ms) sur la courbe `--ease-out` (cubic-bezier(0.22, 1, 0.36, 1)).

### Buttons
- **Shape :** coins doux 8px (`--radius`). Hauteur min 36px, portée à 44px sur
  écrans tactiles (WCAG 2.5.5).
- **Primary :** fond cuir taupe (#8b6f47), texte blanc, padding 8px 16px.
- **Hover / Focus :** primaire → #7a5f3a, `translateY(-1px)`, ombre teintée
  `0 4px 12px rgba(139,111,71,0.3)`. `:active` → `scale(0.97)`. Focus visible :
  outline 2px accent, offset 2px (clavier seulement).
- **Secondary :** lin sourd (#f4f1ec), texte encre, bordure 1px ; hover →
  surface interactive + bordure plus marquée.
- **Ghost :** transparent, texte estompé ; hover → fond interactif léger.
- **Danger :** rouge acte (#9c3b3b), texte blanc ; hover → `brightness(1.08)`.
- **Icon-only :** carré 36px (44px tactile), fond transparent, hover surface douce.

### Cards / Containers
- **Corner Style :** 8px (cartes), 16px (`--radius-lg`) pour les modales.
- **Background :** vélin blanc (#ffffff) sur papier crème.
- **Shadow Strategy :** « Repos posé » au repos (voir Elevation), pas plus.
- **Border :** 1px trait de reliure (#e8e2da), toujours pleine ; jamais de filet
  latéral coloré.
- **Internal Padding :** 16px (`md`).

### Inputs / Fields
- **Style :** bordure 1px (#e8e2da), fond vélin, rayon 8px, padding 8px 12px.
- **Focus :** bordure accent + halo `0 0 0 3px` en lueur taupe (#f0e8da).
- **Error :** `aria-invalid` → bordure rouge acte, halo `rgba(156,59,59,0.18)`,
  message `.field-error` 12px avec icône. Placeholder en encre claire.

### Navigation (Tabs)
- Onglets texte Lato, repos en encre estompée ; hover → encre pleine ; actif →
  texte accent + soulignement 2px accent + poids 700. Barre basse 2px reliure.

### Badges
- Pilule 100px, 11px 700 MAJUSCULES tracées. Variantes sémantiques pâles :
  genre (bleu/rose), statut (vivant vert / défunt gris), accent (taupe sur lueur).
  Fonds atténués en dark. Usage strictement informatif.

### Toasts (signature)
- Carte vélin, ombre « prise de focus », **liseré gauche 4px** coloré par type
  (succès/erreur/info/avertissement) avec icône assortie et barre de progression.
  C'est la **seule** exception assumée au bord-latéral : un code de statut
  transitoire, pas un décor de carte permanent.

### Tree node (signature)
- Le nœud d'arbre est le cœur du produit : transitions `transform` brèves
  (`--t-fast`), `will-change: transform` sur le SVG, code-couleur de genre en
  signal de lecture. Lisibilité prioritaire à toute densité.

## 6. Do's and Don'ts

### Do:
- **Do** garder le cuir taupe (#8b6f47) rare : action et lien seulement, ≤ 10 %
  d'un écran (The Rare Accent Rule).
- **Do** réserver Playfair Display aux titres et aux noms, Lato à tout le reste
  (The Two-Voice Rule).
- **Do** laisser les surfaces plates au repos ; n'élever qu'en réponse à un état
  (The Flat-At-Rest Rule).
- **Do** vérifier le contraste : corps ≥ 4.5:1, placeholders compris ; ne jamais
  descendre le texte courant vers l'encre claire (#847c70).
- **Do** porter genre et statut comme des signaux d'information sobres, en clair
  comme en dark.
- **Do** respecter `prefers-reduced-motion` : crossfade ou transition instantanée
  en repli ; la motion reste brève et sur `--ease-out`.

### Don't:
- **Don't** verser dans le **SaaS générique froid** : pas de bleus corporate en
  fond, pas de dashboard stérile, pas de gradient tech, pas de cartes
  interchangeables. (Anti-référence PRODUCT.md, par son nom.)
- **Don't** utiliser de **gradient text** (`background-clip: text`) ni de texte
  en dégradé ; l'emphase passe par le poids et la taille, en couleur pleine.
- **Don't** poser de **filet latéral coloré** (`border-left`/`right` > 1px) sur
  cartes, listes ou alertes. Seul le toast porte un liseré, comme code de statut.
- **Don't** empiler les cartes ou imbriquer des cartes ; pas de grille de cartes
  identiques répétées à l'infini.
- **Don't** mettre de **glassmorphism** décoratif (le seul flou admis est le
  voile de fond de modale, fonctionnel).
- **Don't** étaler les couleurs de genre/statut comme accents esthétiques
  (The Signal-Not-Decor Rule), ni écrire de phrases en MAJUSCULES.
- **Don't** dériver vers le luxe ostentatoire (or clinquant) ni le ton réseau
  social ludique (couleurs criardes, gamification, emojis structurels).
