# Audit UI/UX senior — Suimini v3

Méthode : `impeccable` (`/audit` + `/critique`) sur l'app web (dark « indigo-night »,
accent or `#c9a84c`, zéro radius, Spectral / Plus Jakarta Sans / IBM Plex Mono).
Audit conduit par lecture du code + inspection navigateur (Playwright, mode démo
« Famille Dupont »). Les surfaces ont été notées /10 selon les 10 heuristiques de
Nielsen + les règles impeccable (contraste WCAG AA, anti-slop, cohérence du
système, hiérarchie, couverture des états).

> Contexte : cet audit suit deux passes récentes (refonte layout/sidebar/arbre/
> dashboard/liste, puis i18n FR/EN complète). Plusieurs surfaces étaient donc déjà
> proches du niveau cible ; l'audit reflète l'état **après** ces passes.

---

## PHASE 1 — Audit par surface

### Dashboard — 8/10
- **CRITIQUE** : barre or 3 px à gauche des cartes stats (`DashboardView.tsx`) — motif
  « side-stripe » que le skill déconseille, mais **décision de marque assumée**
  (demandée explicitement, cohérente avec l'identité or de l'app). Avatar 12 px un
  peu petit.
- **MANQUE** : skeleton de chargement des stats (traité globalement en Task « cache »).
- **FIX** : hero plafonné à `clamp(2.5rem,6vw,4rem)` (déjà fait), date FR localisée,
  bug DOYEN corrigé (vivant le plus âgé), « depuis ~AAAA » dynamique.

### Arbre — Focus — 8/10
- **CRITIQUE** : contraste des prénoms (variante colorée par genre) sous le seuil AA.
- **MANQUE** : libellés de génération non traduits.
- **FIX** : prénom en crème `#F5F0E8` (genre porté par le fond teinté + barre), bandes
  « GÉNÉRATION N », badge « GÉN. », nav précédente/suivante, toggle Focus/Complète **i18n**,
  bouton « Centrer » + recentrage sur resize.

### Arbre — Complète / Éventail — 7.5/10
- **CRITIQUE** : losange conjugal (◇) un peu discret ; distinction lien conjugal /
  filiation subtile sans la légende ; `role="group"` sur le toggle (acceptable via
  `aria-pressed`).
- **FIX** : palette genre **unifiée** avec le reste de l'app (voir P1.1).

### Statistiques — 8/10
- **CRITIQUE** : couleurs genre divergentes du reste de l'app (`var(--male)` ≠ couleur
  des nœuds) → **incohérence visible** + contraste limite du texte coloré.
- **FIX** : `--male`/`--female` redéfinis sur les valeurs vives de l'arbre → donut,
  légende, classements et frise alignés ; le texte coloré passe AA.

### Personnes (liste) — 7.5/10
- **CRITIQUE** : cibles tactiles des chips / tri < 44 px.
- **FIX** : `.btn-sm` relevé à 40 px de hauteur min.

### PersonPanel — 7/10
- **CRITIQUE** : nombreux boutons secondaires < 44 px ; onglets en débordement
  horizontal sur petit écran.
- **FIX** partiel : `.btn-sm` relevé. (Refonte onglets : backlog P2.)

### Chronologie — 8/10 (après fix)
- **CRITIQUE** : **texte blanc sur barres de vie colorées** → contraste < AA.
- **FIX** : texte des barres en encre sombre `#12131a` (passe AA sur bleu/rose/vert/sépia).

### Journal — 7.5/10
- **CRITIQUE** : bordure-accent gauche 3 px (cohérente avec le pattern d'accent de
  l'app) ; badges « personne mentionnée » au survol inline.
- **MANQUE** : lightbox photos.

### Anniversaires — 8/10 (après fix)
- **CRITIQUE** : **texte blanc sur badge or** (contraste catastrophique) + `border-radius
  100px` (viole le zéro-radius).
- **FIX** : badges en encre sombre `#12131a`, radius supprimé (2 emplacements).

### Galerie — 7/10
- **CRITIQUE** : dégradé de scrim custom (vs `--scrim`), couleurs SVG de fallback en dur.
- **MANQUE** : skeleton masonry. (backlog)

### Carte — 7/10 (après fix)
- **CRITIQUE** : couleurs de popup en dur (`#6b6560`, `#a09890`).
- **FIX** : remplacées par `var(--text-light)` / `var(--text-muted)`.

### Paramètres — 7/10 (après fix)
- **CRITIQUE** : avatar `border-radius: 50%` → viole le zéro-radius.
- **FIX** : passé à `var(--radius)` (0).

### Exploration / Ancêtres — 7/10
- **CRITIQUE** : bordure gauche 4 px (pattern d'accent de l'app), survol inline.
- **MANQUE** : états vides plus engageants. (backlog)

### Sidebar — 8/10
- **CRITIQUE** : chips d'action 28 px (densité desktop assumée).
- **FIX** récents : 200 px (180 px sur laptops), marque ajustée, footer compact.

### Modals (Add / TreeSelector / Share / Print / Export) — 7–8/10
- **CRITIQUE** : cibles tactiles des actions de ligne < 44 px ; quelques toasts via
  `alert()` (Print) ; sélecteurs natifs.
- **FIX** : `.btn-sm` relevé ; **TreeSelector & Share entièrement i18n** (passe
  précédente).

### Landing — 8/10
- **CRITIQUE** : palette « ciel constellation » (`--sky #0d0f16`, `--amber #e7b45c`)
  distincte de l'app.
- **DÉCISION** : conservée — registre **marque** (drenched/atmosphérique) volontairement
  distinct du registre **produit** (restreint), conformément à la distinction
  brand/product d'impeccable. Les ors sont des cousins proches. Pas un défaut.

### Auth / HomeGate / Reset password — 7–8/10
- **CRITIQUE** : couleurs de bannière en dur, barres de force de mot de passe fines.
- **FIX** : bannière de lien expiré **i18n** ; écrans de statut (pending/rejected/
  suspended) **i18n**.

---

## PHASE 2 — Plan d'action (P0–P3)

**P0 — Bloquant** : *aucun*. Toutes les surfaces fonctionnent ; rien d'inaccessible
ou de cassé.

**P1 — Critique**
- P1.1 — Fragmentation des couleurs genre (3 palettes incompatibles : nœuds, tokens
  CSS, stats). ✅ corrigé
- P1.2 — Texte blanc sur barres de vie colorées (Chronologie) → contraste < AA. ✅
- P1.3 — Texte blanc sur badges or (Anniversaires) → contraste ~1.6:1. ✅

**P2 — Majeur** (top 5 appliqués)
- P2.1 — Cibles tactiles `.btn-sm` 36 → 40 px. ✅
- P2.2 — `border-radius` non nul (avatar Paramètres `50%`, badges Anniversaires
  `100px`) → zéro-radius. ✅
- P2.3 — Couleurs en dur popup Carte → tokens. ✅
- P2.4 — Unification palette propagée à Stats/Chronologie/légende. ✅ (via P1.1)
- P2.5 — i18n des modals & écrans restants (passe précédente). ✅

**P3 — Polish** (top 3 appliqués)
- P3.1 — Encre sombre cohérente sur tous les fonds or/genre. ✅
- P3.2 — Couleurs de la frise alignées sur le système. ✅
- P3.3 — Suppression des radius parasites. ✅

**Backlog assumé** (non régressif, à planifier) : skeletons de chargement (couverts
par la passe « cache »), lightbox galerie, refonte overflow des onglets PersonPanel,
survols inline → CSS `:focus-visible` (le focus global existe déjà), aperçus de thème
Export PDF.

---

## PHASE 3 — Fixes appliqués (récap fichiers)

| Fix | Fichier | Priorité |
|---|---|---|
| Palette genre unifiée (`--male`/`--female` = valeurs arbre) | `src/app/globals.css` | P1 |
| Cible tactile `.btn-sm` 36→40 px | `src/app/globals.css` | P2 |
| Texte barre de vie → encre sombre (AA) | `src/components/views/TimelineView.tsx` | P1 |
| Badges → encre sombre + zéro-radius (×2) | `src/components/views/BirthdaysView.tsx` | P1/P2 |
| Avatar `50%` → `var(--radius)` | `src/components/views/SettingsView.tsx` | P2 |
| Couleurs popup en dur → tokens | `src/components/views/MapView.tsx` | P3 |

---

## PHASE 4 — Passe craft

- **Dashboard (hero + stats)** : hero Spectral plafonné 4rem, date FR, stats or, bug
  DOYEN corrigé — **production bar** (passe précédente, vérifié navigateur).
- **Arbre (nœuds + nav génération)** : prénoms crème lisibles, genre par fond+barre,
  pivot couronne + losange conjugal, bandes de génération i18n, recentrage —
  **production bar**.
- **Landing (hero + CTAs)** : registre marque conservé (décision documentée ci-dessus),
  déjà cohérent (reduced-motion présent, CTAs clairs). Pas de régression introduite.

Vérifications navigateur : dashboard, arbre (Focus + Complète, FR + EN), liste,
statistiques (palette unifiée confirmée), sidebar 200 px. `tsc --noEmit` ✅ ·
`npm run build` ✅.
