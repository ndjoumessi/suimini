# Rapport d'accessibilité WCAG 2.1 AA — Suimini (web)

**Date** : 8 juillet 2026 · **Périmètre** : application web Next.js (landing, app connectée, pages publiques, modales, formulaires, arbre SVG/HTML) · **Méthode** : audit automatisé axe-core (Playwright, tags `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`) sur 9 états de pages + audit manuel de ~45 composants (4 passes parallèles : formulaires, navigation/structure, arbre/SVG, modales/toasts/live regions).

**Résultat final : 0 violation axe de niveau A ou AA** sur les 6 scans (landing, CGU/confidentialité, vue arbre + panneau personne, dashboard/membres/frise/journal, palette ⌘K, modale export PDF). Garde-fou permanent : `e2e/a11y.spec.ts` (échoue si une violation A/AA réapparaît).

---

## 1. Violations trouvées / corrigées

| Source | Niveau | Trouvées | Corrigées |
|---|---|---|---|
| axe automatisé (1er passage) | A/AA « serious/critical/moderate » | 7 types (meta-viewport, color-contrast ×2, link-in-text-block, select-name, aria-prohibited-attr, scrollable-region-focusable) | **7/7** |
| Audit manuel — P0 (bloquant clavier/SR) | A | 3 (toasts infermables au clavier, NarrativeModal sans trap de focus, OnboardingWizard sans aucune gestion du focus) | **3/3** |
| Audit manuel — P1 (barrière sérieuse) | A/AA | 21 | **21/21** |
| Audit manuel — P2 (modéré) | A/AA | ~45 | **~38** corrigés, 7 documentés (§4) |

## 2. Contrastes — avant / après (fond `--bg #111118` / carte `#1e1e28`)

| Couleur | Usage | Avant | Après | Verdict |
|---|---|---|---|---|
| Or `#C9A84C` | accent, texte doré | **8.22:1 / 7.23:1** | inchangé | ✅ passait déjà — l'assombrissement `#B8922A` proposé était inutile |
| Bleu `#4A90D9` / Rose `#C47BA0` | genre (texte + barres) | 5.62 / 5.99:1 | inchangés (GENDER_BAR intact) | ✅ |
| `--text-muted #9094A6` / `--text-light #888896` | texte secondaire/tertiaire | 6.24 / 5.38:1 | inchangés | ✅ |
| Blanc sur or (toggle langue actif, boutons Format/Thème) | texte 11px bold | **2.28:1 ❌** | encre `#0d0d0d` sur or → **8.50:1** | ✅ corrigé |
| `--info #5b7fa6` | toasts/textes info sur carte | **3.96:1 ❌** | `#7b9ac0` → **5.68:1** | ✅ corrigé |
| `--deceased #8a8276` | badge « décédé » (10px bold) | **3.96:1 ❌** (fond badge) | `#9a9184` → **4.84:1** | ✅ corrigé |
| Tags génération SVG `#5b7fa6/#5b8a6e/#8a5b6e` | texte 8.5px dans les nœuds | **3.1–4.2:1 ❌** | `#7fa0c6/#7fae94/#c490a6` (mêmes teintes, éclaircies) → **5.6–6.3:1** | ✅ corrigé |
| Or livret `#A36B1E` sur blanc | aperçu/print | **4.49:1 ❌** | `#96621C` → **5.17:1** | ✅ corrigé |
| Footer « Document confidentiel » `#555@0.65` sur blanc | livret PDF | **3.15:1 ❌** | `#555` opaque → **7.46:1** | ✅ corrigé (PrintModal + pdfTemplates) |
| Lien mailto or dans texte (CGU) | lien en bloc de texte | non distinguable sans couleur ❌ | souligné | ✅ |
| Boutons désactivés (opacity .45) | — | 4.04:1 | inchangé | exempt WCAG (composant inactif) — documenté |

## 3. Corrections principales par thème

- **Zoom mobile** : `maximumScale: 1` retiré du viewport (1.4.4).
- **Focus visible** : `:focus-visible` global or 2px existait déjà ; ajouté sur les **nœuds SVG** de l'arbre (`.person-node`, `.fan-slot`) + anneau de survol réutilisé ; le focus clavier **recentre le nœud dans le viewport** (`onFocus → centerOn`).
- **Clavier** : toasts = vrais `<button>` (fermables Enter/Espace, pause au survol/focus — 2.2.1) ; trap de focus réparé (`useOverlay` : éléments `position:fixed` désormais inclus) et **branché sur NarrativeModal, OnboardingWizard, PersonPanel mobile (plein écran → dialog + Esc + restauration)** ; zone d'aperçu d'impression focalisable.
- **Skip-link** global (`layout.tsx` → `#main-content` posé sur SuiminiApp, Landing, LegalDoc, PublicTreeView) + utilitaire `.sr-only` créé (il n'existait pas — ShareModal l'appelait dans le vide).
- **Structure** : `<main>` ajouté à la landing + `aria-label` sur sa nav ; h1 sr-only sur mobile (le ContentHeader étant masqué < 768px) ; h1 sur l'arbre public ; dashboard h3→h2 ; frise = `<ol>` + décennies en `<h2>` ; listes de personnes et entrées de journal = `<ul>/<li>` ; landmarks dupliqués dédoublonnés (aside/nav sidebar).
- **Formulaires** : labels programmatiques partout (AuthModal `Field` via `useId`, reset-password, ShareModal email/permission, JournalView, PersonForm photo/champs personnalisés) ; erreurs en `role="alert"` reliées par `aria-describedby` + `aria-invalid` (dates, noms, ADN) ; groupes `role="group"` + `aria-pressed` (genre, format/thème d'export, modes d'impression, mentions) ; `autocomplete` new-password ; `aria-busy` sur les soumissions.
- **Live regions** : conteneur de toasts **permanent** (`role="status"`, erreurs en `role="alert"`), progression d'export annoncée, `role="progressbar"` avec valeur sur l'import, notes de profil annoncées, barre undo/redo en `role="status"`, bannière hors-ligne en `role="status"`, spinners de pages avec texte sr-only, compteur de résultats en `aria-live`.
- **CommandPalette** : vrai pattern combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` **sur l'input** — il était posé sur la listbox, donc inopérant), erreur IA en `role="alert"`.
- **Non-dépendance à la couleur** : genre dit en toutes lettres dans les `aria-label` des nœuds (2 renderers : TreeView SVG + FocusTree/TreeNode) ; « décédé » en texte sr-only sur les cartes ; sélections `aria-pressed` partout où seule la couleur changeait.
- **Icônes** : décoratives → `aria-hidden` (balayage complet) ; fonctionnelles → boutons nommés (`aria-label`), y c. éditer/supprimer des lignes du PersonPanel.

## 4. Composants modifiés (36 fichiers)

`globals.css` (tokens `--info`/`--deceased`, `.sr-only`, `.skip-link`, focus SVG, toasts) · `layout.tsx` · `Toast.tsx` · `LanguageSwitcher.tsx` · `SuiminiApp.tsx` · `Sidebar.tsx` · `ContentHeader.tsx` · `Landing.tsx` · `LegalDoc.tsx` · `PublicTreeView.tsx` · `HomeGate.tsx` · `app/page.tsx` · `profil/page.tsx` · `reset-password/page.tsx` · `ProfilPage.tsx` · `AuthModal.tsx` · `useOverlay.ts` · `NarrativeModal.tsx` · `OnboardingWizard.tsx` · `PrintModal.tsx` · `ExportPDFModal.tsx` · `TreeSelectorModal.tsx` · `ImportExportModal.tsx` · `ShareModal.tsx` · `CommandPalette.tsx` · `PersonForm.tsx` · `PersonCard.tsx` · `PersonPanel.tsx` · `JournalView.tsx` · `ListView.tsx` · `TimelineView.tsx` · `DashboardView.tsx` · `TreeView.tsx` · `FocusTree.tsx` · `TreeNode.tsx` · `HistoryIndicator.tsx` · `LoadingSpinner.tsx` · `pdfTemplates.ts` · `messages/{fr,en}.json` (18 clés, parité vérifiée).

## 5. Points restants (hors périmètre AA ou reportés)

- **AAA non traités** (hors périmètre) : contraste 7:1, 2.4.8 localisation, 3.1.5 niveau de lecture.
- **P2 reportés** : navigation aux flèches dans les onglets ARIA (ShareModal/PersonPanel — Tab fonctionne) ; pan de l'arbre au clavier (le zoom et le recentrage clavier existent ; le focus recentre déjà) ; équivalent clavier du double-clic « focus famille » (la sélection Enter couvre l'essentiel) ; navigation frères/sœurs par swipe (FocusTree) sans équivalent clavier ; badges d'angle des nœuds (`photos/sources`) masqués aux lecteurs d'écran ; déplacement de focus entre étapes d'AddPersonModal ; annonce du résultat de NarrativeModal (aria-busy seul) ; niveau de titre paramétrable d'EmptyState.
- **Exemption assumée** : boutons désactivés < 4.5:1 (WCAG exempte les composants inactifs).
- **Bordures d'inputs** (`--border-strong` 1.48:1, non-texte 1.4.11) : conservées — les champs restent identifiables par label + fond + focus or 2px ; passer les bordures à 3:1 aurait altéré l'esthétique Modern Heritage. À réévaluer si un audit externe l'exige.

## 6. Validation

- axe-core : **0 violation A/AA** × 6 scans (`e2e/a11y.spec.ts`, rejouable : `npm run test:e2e -- a11y`).
- Non-régression fonctionnelle : **38/38** tests e2e (smoke, démo, persistance d'édition, dashboard, navigation, arbre, auth, sync).
- `tsc --noEmit` ✅ · `npm run build` ✅ · design « Modern Heritage » vérifié visuellement (landing + app) : inchangé ; `GENDER_BAR` intact.
