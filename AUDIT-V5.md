# AUDIT V5 — Suimini · UI/UX (web « Veillée » + mobile « Canopée »)

> Date : 16 juillet 2026 · Méthode : lecture intégrale du code (~65 composants web, 30 fichiers mobile, `globals.css`, `mobile/lib/theme.ts`), ratios de contraste recalculés (WCAG 2.1), croisement avec `ACCESSIBILITE_RAPPORT.md`. Audit en lecture seule, aucun fichier modifié.
>
> **AUDIT-V4.md est obsolète** : daté du 28/06/2026, il décrit l'ancien design system « Atelier » (zéro-radius, palette indigo-nuit) remplacé depuis par un redesign complet (« Veillée »). Ce document (V5) le remplace comme référence.

> ⚠️ **Statut du rapport a11y existant** : `ACCESSIBILITE_RAPPORT.md` (8/07/2026) est antérieur au redesign « Veillée » du 13/07 — il référence l'ancienne palette et ses ratios sont calculés sur des fonds qui n'existent plus. Le garde-fou `e2e/a11y.spec.ts` reste valide ; les contrastes ci-dessous sont recalculés sur la palette actuelle.
>
> ⚠️ **Dérive doc repérée en passant** : `CLAUDE.md` annonce `GENDER_BAR.unknown = #3A3A4A` ; le code réel dit `#4a4033` (`src/components/tree/nodeStyle.ts:37`).

## Scores par surface

| Surface | Score | Résumé |
|---|---|---|
| Web — Landing | **8.5/10** | Reduced-motion, aria-pressed, skip-link, contrastes sains ; 1 accroc i18n |
| Web — Auth (`AuthModal`) | **7.5/10** | Modale exemplaire ; encarts erreur/succès en hex figés cassent le thème clair |
| Web — Shell/navigation (`SuiminiApp`, `Sidebar`, `BottomNav`) | **8/10** | États offline/erreur/vide remarquables ; cibles 40×38px, contraste `ExpiredBanner` clair |
| Web — Vues (`Dashboard`…`Birthdays`) | **8/10** | i18n/dates/aria-hidden rigoureux ; avatar « inconnu » en échec de contraste, MapView faible |
| Web — Arbre (`TreeView`/`FocusTree`/toolbar) | **8/10** | A11y SVG rare (clavier + genre énoncé) ; cibles 24-40px, label recherche manquant |
| Web — Fiche/formulaires (`PersonPanel`/`PersonForm`) | **7.5/10** | Formulaires exemplaires ; 2 modales imbriquées hors `useOverlay`, selects inline sans label |
| Web — Modales export/partage | **8.5/10** | `useOverlay` + états partout ; `PrintModal` en retrait (`alert()`, popup silencieux) |
| Web — CommandPalette | **9/10** | Combobox ARIA de référence ; erreur IA en couleur accent |
| Web — Pages légales (`LegalDoc`) | **9.5/10** | i18n `t.rich`, liens soulignés, hiérarchie — rien à signaler |
| Mobile — Auth | **8.5/10** | KAV, `textContentType`/Keychain ; « Se souvenir » décoratif |
| Mobile — Tabs/navigation | **8/10** | TabBar/StatusBanner excellents ; empty states sans CTA, « 1980s » non localisé |
| Mobile — Arbre | **6/10** | **Surface la plus faible** : nœuds SVG invisibles aux lecteurs d'écran, zéro alternative au pinch |
| Mobile — Édition personne | **8.5/10** | Anti-doublon, swipe-delete avec alternative a11y ; genre limité à H/F (perte de données) |
| Mobile — Settings | **8.5/10** | syncStatus/offline affiché, toggles a11y complets |
| **Cohérence inter-plateforme** | **7/10** | Figtree partagé ✓ ; genres, serif display et palettes divergents sans doc |
| **Global** | **7.9/10** | Base a11y/états très au-dessus de la moyenne ; défauts concentrés sur le thème clair, la couleur « inconnu » et l'arbre mobile |

---

## P0 — Bloquants (fail WCAG net / perte fonctionnelle)

1. **Avatar « genre inconnu » : contraste 1,86:1 dans les DEUX thèmes** — `src/components/views/AncestorsView.tsx:368` : `.ex-avatar { color: var(--ink-on-accent) }` (#171006) sur fond `genderColor()` = `GENDER_BAR.unknown` `#4a4033` (Avatar ligne 405-413). Initiales quasi illisibles partout. **Fix** : pour `unknown`, dériver un couple fond/texte theme-aware (ex. `bg: var(--bg-muted)` + `color: var(--ink)`), comme le fait déjà `LIGHT_STYLES.unknown` de `nodeStyle.ts:60` pour l'arbre.

2. **DemoBanner : bouton « Quitter » sans nom accessible sur mobile** — `src/components/DemoBanner.tsx:18` : le `<button>` n'a pas d'`aria-label` ; son libellé `.demo-banner-exit-label` passe en `display:none` à ≤560px (ligne 49) → icône ArrowLeft seule, aucun nom accessible (WCAG 4.1.2). **Fix** : `aria-label={t('quit')}` sur le bouton.

3. **Arbre mobile invisible aux lecteurs d'écran + gestes sans alternative** — `mobile/components/tree/PersonNode.tsx:41` : `<G onPress>` sans `accessibilityRole`/`accessibilityLabel` (les nœuds ne sont ni identifiables ni activables en VoiceOver/TalkBack) ; `mobile/components/tree/TreeView.tsx` : zoom exclusivement au pinch, aucun bouton +/−/recentrer (WCAG 2.5.1). **Fix** : props d'accessibilité sur chaque nœud (nom + années + genre en toutes lettres, miroir de l'aria-label web `TreeView.tsx:1092`), et une rangée de boutons zoom/reset comme la toolbar web.

---

## P1 — Critiques

### Web — contrastes thème clair (angle mort documenté mais réel)
4. **`ExpiredBanner` : 3,35:1 en thème clair** — `src/components/HomeGate.tsx:31` : `background: var(--warning)` + `color: var(--ink-on-accent)`. En clair `--warning = #8a5f1e` (`globals.css:184`) + encre `#171006` → 3,35:1 pour du 14px bold (seuil 4.5:1). OK en sombre (`#d8a555`). **Fix** : encart tinté (`color-mix(in srgb, var(--warning) 18%, var(--bg-card))` + `color: var(--ink)`).
5. **Avatars « inconnu » sombres sur sombre en thème clair** — `src/components/person/PersonAvatar.tsx:39-40` et `PersonCard.tsx:35`. Même famille que le P0 #1. **Fix** : centraliser un helper `avatarColors(gender, mode)`.
6. **Barres de vie Timeline** — `src/components/views/TimelineView.tsx:469` : en clair `--info #3e6b94`/`--success #256b4e` sous `var(--ink-on-accent)` → ~3,35:1. **Fix** : texte `var(--bg)` en thème clair, ou éclaircir les fonds de barre.
7. **AuthModal : encarts erreur/succès en hex nocturnes figés** — `AuthModal.tsx:348-349` : `.auth-msg-err`/`.auth-msg-ok` en hex quasi noirs, incongrus en light mode. **Fix** : tokeniser (`color-mix` sur `--danger`/`--success`).
8. **GalleryView / PersonPanel** — `.gv-del` en rgba/hex (lignes 490,492,507) au lieu de `--danger` ; `FALLBACK_IMG` SVG hex sombre (ligne 212) non theme-aware ; même motif `PersonPanel.tsx:1456-1469`.

### Web — clavier / lecteurs d'écran
9. **Deux modales imbriquées de PersonPanel hors `useOverlay`** — `PersonPanel.tsx:1381-1403` et `1406-1427` : `role="dialog" aria-modal` posés mais ni focus-trap ni Esc. **Fix** : extraire en sous-composants montés-si-ouverts avec `useOverlay`.
10. **Champs sans nom accessible** — recherche toolbar arbre (`TreeToolbar.tsx:101`) ; selects inline relation/événement (`PersonPanel.tsx:799`). **Fix** : `aria-label` explicites.
11. **Empilement Esc** — `useOverlay.ts:44` fait `stopPropagation()` (pas `stopImmediatePropagation`) : deux modales ouvertes → Échap ferme les deux d'un coup. **Fix** : pile d'overlays ou `stopImmediatePropagation` + ordre LIFO.
12. **Erreur IA en couleur accent** — `CommandPalette.tsx:481` : `role="alert"` mais `color: var(--accent)` (or, sémantique neutre/succès ailleurs). **Fix** : `var(--danger)`.
13. **PrintModal : échecs silencieux** — popup bloquée → `return` muet (`:289`) ; `alert()` natif (`:255`) ; type d'événement brut non traduit dans le document imprimé (`:525`). **Fix** : aligner sur `ExportPDFModal` (`ErrorMessage` + `onRetry`).
14. **MapView** — naissance/décès distingués par la couleur seule (`:52-56`, WCAG 1.4.1) ; `L.divIcon` sans nom accessible (`:47-58`) ; empty state sans CTA (`:188-196`). **Fix** : glyphe ▲/✝ + `alt`/`aria-label`.
15. **Frise « Vie » (LifeTimeline)** invisible clavier/SR — `PersonPanel.tsx:1616-1660` : événements décrits seulement par `<title>` au survol. **Fix** : `role="img"` + `aria-label` résumant les événements.

### Mobile
16. **Sélecteur de genre limité à H/F** — `mobile/app/person/edit.tsx:285-288` : seuls `male`/`female` proposés (types supportent 4 valeurs). Perte de données + divergence avec le web. **Fix** : ajouter `other`/`unknown`.
17. **Couleurs de genre/statut fixes → échec de contraste en mode sombre** — `mobile/lib/theme.ts:31-34` : non résolues par schéma (contrairement à l'accent) ; ~3,3:1 sur surfaces sombres en 11pt (`Badge.tsx:27-31`, `Avatar.tsx:60-70`). **Fix** : variantes éclaircies dans `darkPalette`.

---

## P2 — Importants

**Web**
18. Cibles tactiles sous 44px : `btn-sm btn-icon` ~40×38 (header mobile, X UpdateBanner), toggle Focus/Complète 32px, × 24px (TreeView), `pp-relx`/`pp-photo-del` 24-28px, X ExpiredBanner ~24px, boutons DemoBanner 26-28px.
19. Suppressions incohérentes (relations/événements/notes immédiates vs personne/photo confirmées) ; fenêtre d'undo visible 4s seulement.
20. `window.confirm` natif pour retirer un membre (`ShareModal.tsx:194`) ; copie de lien sans annonce `aria-live`.
21. Palettes de génération divergentes entre TreeView et FocusTree (décoratif, mais incohérent).
22. Hex genre dupliqués hors source unique (légende `TreeView.tsx:1457,1460`, `PersonForm.tsx:376-377`) au lieu de `var(--male)`/`var(--female)`.
23. Sidebar : `--accent-text` opacity .85 en 10px rogne la marge de contraste ; micro-typo 8.5-9px ; encre-sur-danger dupliquée.
24. Landing : `aria-label` FR/EN en dur (seule entorse i18n du fichier).
25. Onglets AncestorsView incomplets (`tablist`/`tab` sans `tabpanel`/`aria-controls`/flèches) ; table comparative serrée à 390px.
26. Modales secondaires sans Esc/trap (SettingsView delete/clear-cache, GalleryView upload/delete).
27. `ErrorMessage`/`LoadingSpinner` non importés par les 10 vues (récupération déléguée au shell — acceptable, à documenter).
28. BirthdaysView : hover JS sans équivalent focus ; regroupement mensuel fusionnant janvier N et N+1.
29. ImportExportModal : erreurs en `role="status"` au lieu de `role="alert"`.
30. Fan chart : genre absent de l'aria-label des slots.
31. Nœuds décédés : opacité 0.72 empilée avec dimming focus 0.15 → cartes très pâles.

**Mobile**
32. Empty states sans CTA (home, tree, timeline).
33. « 1980s » non localisé (`timeline.tsx:89`) — seul vrai trou i18n mobile.
34. Timeline sans pull-to-refresh.
35. `Input.tsx` : label non relié via `accessibilityLabel`.
36. « Se souvenir de moi » décoratif (a11y correcte mais contrôle trompeur).
37. `PhotoAdjustControl` : pas de `onAccessibilityAction` increment/decrement.
38. Genre par couleur seule sur le disque des nœuds ; texte SVG insensible au Dynamic Type.

---

## Cohérence inter-plateforme — 7/10

**Convergences** : Figtree partagé (UI) ✓, IBM Plex Mono ✓, échelle 4pt symétrique ✓, mode sombre réel des deux côtés ✓, philosophie accent « or nuit / vert forêt jour » documentée et assumée ✓.

**Divergences non documentées** : couleurs de genre différentes web/mobile (jamais commenté, contrairement à l'accent) ; serif display différente (Playfair vs DM Serif, « cousines » selon CLAUDE.md mais jamais énoncé côté mobile) ; capacités inégales (genre 4 vs 2 valeurs, empty states avec/sans CTA, zoom arbre avec/sans boutons).

## États — synthèse

Très bon niveau web : bannière offline + échec de sync avec « Réessayer » (`SuiminiApp.tsx:633-647`), `SyncFailedState` distinct de l'onboarding, `error.tsx`/`global-error.tsx` conformes, anti-double-submit systématique, empty states avec CTA sur List/Gallery/Journal/Birthdays. Trous : MapView sans CTA, PrintModal silencieux. Mobile : offline affiché dans Settings seulement, `StatusBanner` incident excellent.

## Responsive 390px

Sain dans l'ensemble (BottomNav, PersonPanel bottom-sheet plein écran, h1 sr-only mobile). Tensions : table comparative Ancestors, vue « siècle » Timeline en scroll horizontal large, cibles héritées `btn-sm btn-icon` dans le header mobile.

## Top 5 des corrections au meilleur ratio impact/effort

1. `DemoBanner.tsx:18` — un attribut `aria-label` (P0, 1 ligne).
2. Helper `avatarColors()` theme-aware pour le genre « inconnu » → corrige AncestorsView, PersonAvatar, PersonCard d'un coup (P0+P1).
3. `edit.tsx` mobile — ajouter `other`/`unknown` au sélecteur de genre (P1, perte de données).
4. `HomeGate.tsx:31` + `AuthModal.tsx:348-349` + `TimelineView.tsx:469` — tokeniser les 3 angles morts du thème clair (P1).
5. Arbre mobile — `accessibilityLabel` sur `PersonNode` + boutons zoom/reset (P0, débloque la surface la plus faible).

**Points forts à préserver** (au-dessus des standards du marché) : navigation clavier réelle dans l'arbre SVG avec genre énoncé et recentrage au focus ; `useOverlay` réf-compté avec restauration de focus ; combobox ARIA complet (CommandPalette, PersonCombobox) ; toasts pausables au focus ; alternative accessible au swipe-to-delete mobile ; `prefers-reduced-motion` systématique ; i18n quasi sans faille des deux côtés.
