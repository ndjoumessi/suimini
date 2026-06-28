# AUDIT V4 — Suimini · UI/UX senior (méthode impeccable)

> Date : 2026-06-28 · Méthode : heuristiques Nielsen + critères impeccable (anti-slop, WCAG AA, zéro-radius, typographie, hiérarchie) + UX fonctionnel (flux, états vides, feedback, erreurs).
> Échelle : **/10** par surface. Sévérité : **P0** (bloquant / WCAG fail / fuite de permission), **P1** (critique), **P2** (important).

## Note de méthode (faux positifs écartés)

- **`:focus-visible` est global** (`globals.css:192` → `outline: 2px solid var(--accent)`). Il n'y a donc PAS de manque systémique de focus clavier. Restent seulement : les nœuds SVG `<g role="button">` (l'outline rend mal sur un `<g>`) et quelques `outline:none` volontaires.
- **`var(--radius-lg)` = `0`** (`globals.css:66-70`, toute l'échelle est à 0). `borderRadius: var(--radius*)` n'est donc jamais une violation. Seules les **valeurs littérales non nulles** comptent.
- **L'anglais affiché quand `NEXT_LOCALE=en`** n'est pas un bug : c'est la locale de session. Seules les chaînes **réellement codées en dur** (hors `t()`) sont signalées.

---

## 1. Landing

### Landing — Hero / Manifeste / Témoignages / Features / Figures / Tarifs / CTA / Footer
SCORE: 9/10
CRITIQUE : surface distinctive et soignée (constellation midnight, Spectral unique, accent ambre, motion sobre + fallback reduced-motion). Polish récent : contraste `--star-faint` relevé (≥4.5:1), focus-visible ambre ajouté, CSS mort retiré, count localisé. Reste mineur : poids `200` sur très grands titres (strokes fins en basse densité) — choix de voix assumé ; liens nav masqués <720px (acceptable, le footer les reprend).
MANQUE : rien de bloquant.
FIX : RAS (déjà passé en `/impeccable polish`).

### Pages légales — /cgu, /confidentialite
SCORE: 8.5/10
CRITIQUE : entièrement i18n (composant `LegalDoc`, namespaces `cgu`/`privacy`), design dark cohérent, toggle FR/EN, lien retour. Le `<title>` (metadata) reste FR quelle que soit la locale (server-only).
MANQUE : metadata localisée (générateMetadata lisant le cookie).
FIX : `generateMetadata` locale-aware si l'on veut le titre d'onglet bilingue (P2).

---

## 2. App — Auth & shell

### AuthModal
SCORE: 7/10
CRITIQUE : la case **« Se souvenir de moi » est inerte** (`AuthModal.tsx:31,218`) — l'état n'est jamais passé à `signIn` (`:76`). Placeholder ~2.5:1 (`:320`, `rgba(245,240,232,0.3)`). Erreur non effacée quand on édite email/nom (`:257`).
MANQUE : pas de consentement CGU/Confidentialité à l'inscription ; pas de cooldown « lien renvoyé ».
FIX : brancher `remember` sur `signIn` (persistance de session) ou le retirer ; remonter le placeholder à ≥0.45 ; vider l'erreur dans `Field.onChange`.

### Sidebar (desktop + drawer mobile)
SCORE: 7.5/10
CRITIQUE : eyebrow « ARBRE ACTIF » en `--text-light` `#6c6c82` sur `--bg-card` ≈ **3.2:1** (`:362`). Cibles tactiles du drawer mobile à 34px (`:386,447`).
MANQUE : poll `countPendingSuggestions` sans gestion d'échec (silencieux).
FIX : eyebrow → `--text-muted` ; `.sb-item { min-height:44px }` sous `@max-width:768px`.

### BottomNav (mobile)
SCORE: 7/10
CRITIQUE : aucun état actif quand la vue ∉ {tree, persons, map, journal} (`:13-18`) — le dashboard (vue par défaut) n'a pas d'onglet, l'utilisateur perd le repère « où suis-je ». Cibles 52px : bonnes.
MANQUE : pas de badge (ex. anniversaires) repris du sidebar.
FIX : ajouter un item dashboard ou activer « Menu » en repli.

### SuiminiApp — orchestration / toasts / bannières
SCORE: 5/10
CRITIQUE : **~20+ chaînes de toasts codées en dur en FR** (hors `t()`) → restent FR en `en` (`:235,256,265,312,534-536,545,581-586,659,671-675`). Fallbacks de lazy-load en texte nu FR (`:52,61`) sans spinner.
MANQUE : i18n des toasts ; spinner dans les fallbacks dynamiques.
FIX : router tous les toasts via un namespace `toasts` (voir P1, **différé** — chantier dédié, ~40 sites).

### HomeGate — splash & expired banner
SCORE: 6/10
CRITIQUE : le **Splash est clair (`#f4f1ea` crème + terracotta `#bf4b2c`)** sur une app dark (`:18-20`) → flash crème hors-charte avant l'app/landing. `ExpiredBanner` utilise aussi l'ancienne palette (`#c77d1a/#1b1b1b`, `:29`).
FIX : repeindre Splash + ExpiredBanner avec les tokens dark (`--bg/--ink/--accent/--warning`).

---

## 3. App — Dashboard, Arbre, Liste

### Dashboard
SCORE: 8.5/10
CRITIQUE : soigné (passe récente : hover discret unifié accès rapide + IA, avatars carrés, bordure stats or, date localisée). Mineur : trio hero de gros chiffres proche du template.
FIX : RAS bloquant.

### FocusTree (arbre centré)
SCORE: 8.5/10
CRITIQUE : nœuds = vrais `<button>` avec focus-visible + aria-labels (solide). `.ft-center-btn` 38px et `.ft-crumb` < 44px tactile. Bande de génération la plus ancienne `#8a5b6e` = couleur femelle de l'avatar (collision sémantique latente).
FIX : agrandir les cibles tactiles ; distinguer la teinte de génération.

### TreeView (arbre complet + éventail)
SCORE: 7/10
CRITIQUE : **texte blanc sur anneaux taupe clairs de l'éventail ≈ 1.6:1** (`:1196,1200`) — noms d'ancêtres illisibles (WCAG fail). **« Minimap » codé en dur** (`:1107`). Nœuds SVG `<g role=button>` sans focus visible fiable. Légende avec hex genre en dur (`:986,989`). Pills `borderRadius:100px` (`:1008,1023`).
FIX : texte éventail en encre sombre ; `t('minimap')` ; rect de focus sur les nœuds SVG ; légende via `GENDER_BAR`.

### ListView (répertoire)
SCORE: 8.5/10
CRITIQUE : passe récente (nom une ligne « Prénom NOM » / « NOM », rows 52px, avatar 36px carré, hover #1A1A24 + barre or). RAS majeur.
FIX : RAS.

---

## 4. App — Personne

### PersonPanel (tous les onglets)
SCORE: 7.5/10
CRITIQUE : **onglet Sources éditable en lecture seule** — ajout/suppression de citation non gardés par `!readOnly` (`:907,913`) contrairement à Notes/Events/Relations → **fuite de permission**. Formulaires d'édition en `document.getElementById` + `defaultValue` (`:681-686,767-773,845`) = non idiomatique. `<select>` de relation sans nom accessible (`:672`). Cibles inline < 44px ; `borderRadius` littéraux (`:546` 100px, `:1542` 3px).
MANQUE : RAS (états vides/erreur/loading bien couverts, aria-live narratif).
FIX : garder Sources derrière `!readOnly` ; passer les éditions en state contrôlé ; `aria-label` sur le select.

### PersonForm (ajout / édition)
SCORE: 8/10
CRITIQUE : littéraux hors-token (`#a98f4e`, `#1A1A24`, `:337,343,352,356`) ≠ `--accent-text`/`--bg-card`. Validation « nom requis » uniquement via bouton désactivé (`:327`) → aucun message si le nom manque. URL galerie ajoutable seulement par Entrée (`:259`).
FIX : tokens à la place des littéraux ; message inline / `aria-invalid` quand le nom manque.

---

## 5. App — Vues

### Timeline / Chronologie
SCORE: 8/10
CRITIQUE : **toggle actif `#fff` sur or ≈ 2.3:1** (`:270`) — WCAG fail, et incohérent (Birthdays/Gallery mettent de l'encre sombre sur or). État vide pauvre (titre seul, `:349`). Petits labels `--text-light` 9-10px.
FIX : encre sombre `#12131a` sur le toggle actif ; enrichir l'état vide.

### Journal
SCORE: 8/10
CRITIQUE : aucun feedback après sauvegarde (`:76-82`). URL photo rejetée silencieusement (`:64-67`). Compteur en `--text-light` 12px.
FIX : toast à la sauvegarde ; avertir si URL invalide.

### Birthdays / Anniversaires
SCORE: 8.5/10
CRITIQUE : meilleur état vide (icône + titre + description contextuelle + 2 CTA de récupération). Clés de liste par index (`:127,149`).
FIX : clés stables `person.id+type`.

### Gallery / Galerie
SCORE: 8/10
CRITIQUE : suppression en grille **hover-only** → injoignable au tactile (`:416-417`). Lightbox sans `role=dialog`/focus-trap (`:364`). Échec d'upload avalé (`catch {}`, `:152`). Rouges en dur ≠ `--danger` (`:416,432`).
FIX : révéler la suppression en `@media (hover:none)` ; sémantique dialog + focus-trap ; toast d'erreur ; `var(--danger)`.

### Ancestors / Exploration familiale
SCORE: 8/10
CRITIQUE : **« ans » codé en dur** (`:437`, `· ${age} ans`) → reste FR en EN. Hex en dur dupliquant des tokens (`:310,311,319,...`). Onglets 40px tactile.
FIX : `formatAge(age, locale)` ; tokens à la place des hex.

### Statistics / Statistiques
SCORE: 8/10
CRITIQUE : cartes « personnes notables » non cliquables (`:457-499`) alors que le même motif est cliquable ailleurs. Petits labels `--text-light` <4.5:1 (`:96,292`). Trio hero templaté.
FIX : cartes notables en `<button>` + `onSelectPerson` ; ticks/légende → `--text-muted`.

### Settings / Paramètres
SCORE: 8.5/10
CRITIQUE : `clearCache` via `window.confirm` natif (`:101`) alors que la suppression de compte a une modale maison → confirmations incohérentes. Quelques hex d'input en dur.
FIX : remplacer `window.confirm` par la modale maison ; tokeniser les hex.

### CommandPalette
SCORE: 8/10
CRITIQUE : rayons littéraux non nuls (`2px/4px/50%`, `:118,129,372,397,410,502`). Badge **« IA » en dur** (`:432`). Input de recherche `outline:none` (`:395`). Toggles ~24px tactile.
FIX : rayons à 0 ; localiser « IA » ; garder un focus visible sur l'input.

---

## 6. App — Modales & primitives

### ShareModal
SCORE: 8.5/10 — redesign récent (boutons uniformes sans couleurs de marque, toggles carrés, sections claires, tip sans side-stripe). RAS majeur.

### PrintModal
SCORE: 8.5/10 — redesign récent (contenu blanc imprimable, avatars initiales, en-tête document, NAISSANCE/DÉCÈS, @media print, print-color-adjust). RAS majeur.

### Demo banner
SCORE: 8/10 — bannière mode démo claire (déjà passée en redesign). Intégrée à SuiminiApp.

### Primitives UI — EmptyState / ErrorMessage / LoadingSpinner
SCORE: 6.5/10
CRITIQUE : **`ErrorMessage` : « Réessayer » codé en dur** (`:38`, FR fuite chez 6 consommateurs) **et couleur erronée** — fond terracotta périmé `rgba(191,75,44,0.08)` + texte/bordure **or** `--accent` (`:12-15`) au lieu de `--danger`. `LoadingSpinner` toujours `aria-hidden`. `EmptyState` propre mais peu réutilisé (Stats/Ancestors refont le leur).
FIX : `ErrorMessage` i18n + recoloration `--danger` ; `LoadingSpinner` avec label optionnel ; standardiser `EmptyState`.

---

## Récapitulatif

**Score moyen global : ≈ 7,8 / 10.** Application mature et cohérente (design system dark « Atelier » solide, zéro-radius quasi partout, focus-visible global, i18n large). Les défauts sont ciblés, pas structurels. Aucun crash bloquant ; les « P0 » ci-dessous sont des fuites de permission / échecs WCAG / incohérences de marque.

### Top P0 (à corriger maintenant)
1. **PersonPanel — onglet Sources éditable en lecture seule** (fuite de permission) — `PersonPanel.tsx:907,913`.
2. **Éventail (TreeView) — texte blanc sur taupe clair ≈ 1.6:1**, noms d'ancêtres illisibles (WCAG fail) — `TreeView.tsx:1196,1200`.
3. **Timeline — toggle actif `#fff` sur or ≈ 2.3:1** (WCAG fail) — `TimelineView.tsx:270`.
4. **ErrorMessage — couleur d'erreur = or sur terracotta périmé + « Réessayer » FR en dur** (toutes les erreurs de l'app) — `ErrorMessage.tsx:12-15,38`.
5. **HomeGate — splash crème clair** hors-charte sur app dark (flash) — `HomeGate.tsx:18-20`.

### Top P1 (critiques)
1. **PersonAvatar — genre incohérent** : homme = **or** `#c9a84c` (collision avec le pivot) / femme `#8a5b6e`, vs `GENDER_BAR` bleu/rose du reste de l'app — `PersonAvatar.tsx:27`.
2. **SuiminiApp — ~40 toasts/chaînes en dur** non i18n — `SuiminiApp.tsx` (chantier dédié).
3. **TreeView — « Minimap » en dur** — `:1107`.
4. **AncestorsView — « ans » en dur** — `:437`.
5. **AuthModal — « Se souvenir de moi » inerte** — `:31,76,218`.
6. **PersonForm — pas de message quand le nom requis manque** (bouton seulement désactivé) — `:327`.
7. **Gallery — suppression grille hover-only** injoignable au tactile — `:416-417`.
8. **CommandPalette — badge « IA » en dur** — `:432`.
9. **Sidebar — eyebrow « ARBRE ACTIF » ≈ 3.2:1** — `:362`.
10. **PersonForm/Ancestors/Settings — littéraux hex hors-token** (drift) — multiples.

### Top P2 (importants)
1. Cibles tactiles < 44px récurrentes (toggles, icônes inline) — Timeline, Gallery, PersonPanel, CommandPalette, Sidebar mobile, Ancestors.
2. `--text-light` `#6c6c82` (~3.2:1) employé sur du petit texte essentiel (Timeline ticks, Journal compteur, Stats légende).
3. Rayons littéraux non nuls (PersonPanel `100px/3px`, TreeView `100px`, CommandPalette `2px/4px/50%`).
4. Gallery — lightbox sans `role=dialog`/focus-trap.
5. Timeline — état vide sans description/CTA.
6. Journal — pas de feedback de sauvegarde ; URL photo rejetée en silence.
7. Statistics — cartes notables non cliquables ; états vides bespoke (non `EmptyState`).
8. Settings — `window.confirm` natif pour vider le cache.
9. BottomNav — pas d'état actif hors 4 vues.
10. Birthdays — clés de liste par index.

### Plan d'action priorisé
- **Lot 1 (ce commit — P0 + P1 contenus, sûrs)** : Sources readOnly · contraste éventail · toggle Timeline · ErrorMessage (danger + i18n) · HomeGate dark · PersonAvatar `GENDER_BAR` · TreeView « Minimap » · Ancestors « ans ».
- **Lot 2 (chantier i18n dédié)** : SuiminiApp ~40 toasts + fallbacks lazy → namespace `toasts` (différé pour éviter le risque de régression dans ce commit).
- **Lot 3 (P2 ergonomie)** : passe tactile ≥44px globale · `--text-light`→`--text-muted` sur petit texte · rayons littéraux → 0 · lightbox dialog/focus-trap · feedbacks Journal · cartes Stats cliquables.
