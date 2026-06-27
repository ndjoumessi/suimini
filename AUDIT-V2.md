# Audit V2 — Suimini (bugs fonctionnels + UX/UI)

**Date :** 2026-06-27 · **Build :** `main` @ `0b200e7` · **Périmètre :** app `/app` (pas la landing)
**Méthode :** `impeccable` `audit.md` (a11y/perf/responsive/theming/anti-slop) + `critique.md` (heuristiques Nielsen, charge cognitive, personas) + `interaction-design.md` (8 états, focus, modals, undo). Investigation bugs par lecture de code + **test Playwright réel** (démo « Famille Dupont », desktop 1440×900 + mobile 390×844). TEDA non testable en direct (auth requise) → analyse par le code de chargement + les scripts SQL `supabase/teda/`.
**Note :** audit seul, aucun code modifié pour produire ce rapport.

---

## A. BUGS FONCTIONNELS INVESTIGUÉS

### 1. Génération 6 absente de la navigation Focus — **NON reproduit côté front-end → cause DONNÉES**

**Diagnostic (preuves) :**
- `FocusTree.tsx` n'a **aucun plafond de profondeur** : `parents = getParents(focus)`, `children = getChildren(focus)`, rendus intégralement (`children.map`, pas de `slice`). `buildGenMap` est un BFS sur **tout** le graphe.
- **Test Playwright** sur la démo : la navigation « Génération suivante » descend jusqu'à la **génération la plus profonde des données** (Gabriel, gén. 5) puis s'arrête faute d'enfants. Bandes affichées : `GÉNÉRATION 3 → 4 → 5`. Donc le composant descend aussi loin que la donnée existe.
- `lib/supabaseSync.ts` : les requêtes `persons`/`relationships` sont des `select('*').eq('tree_id', …)` **sans `.limit()` ni `.range()`**. Le plafond PostgREST par défaut (1000 lignes) est très au-dessus des 57 personnes / 67 relations de TEDA.
- Direction des relations correcte (`seed-teda.sql` : `type='parent'`, `person1_id=PARENT`, `person2_id=ENFANT`), cohérente avec `getParents`/`getChildren`.

**Conclusion :** Focus et Complet partagent **les mêmes données + helpers** ; une génération visible dans l'un l'est dans l'autre. L'absence de gén. 6 dans TEDA = **données incomplètes dans la session** : soit les scripts de branche profonde (`update-teda-branche-etendue.sql`, `update-teda-v3-corrections.sql`) ne sont pas appliqués en prod, soit le **cache localStorage est périmé** (arbre chargé avant l'ajout des branches), soit session hors-ligne/non connectée.

**BUG : bloquant (P0) — mais côté DONNÉES, pas code.**
**FIX :** (a) exécuter les scripts `supabase/teda/*.sql` manquants dans le **SQL Editor** Supabase (l'agent ne peut pas écrire en prod — pas de `service_role`) ; (b) forcer un **resync** (Paramètres → « Resynchroniser » qui purge le cache local) ; (c) vérifier connecté + en ligne. Aucune correction front-end ne peut faire apparaître une génération absente des données.

### 2. Sidebar mobile incomplète — **DÉJÀ CORRIGÉ (`0b200e7`)**

`Sidebar.tsx` mobile : le tiroir défile en entier (`overflow-y:auto`) et `.sb-nav { flex:0 0 auto }` lui donne sa hauteur naturelle. **Test Playwright 390×844 :** tous les items visibles (Accueil, Arbre, Personnes, Carte, Chronologie, Journal, Anniversaires, Galerie, Exploration, Statistiques, Paramètres) + Ajouter une personne. **BUG : résolu.**

### 3. Navigation gén. 0 → 6 sans blocage — **front-end OK ; limite d'affordance mineure**

La navigation atteint la génération la plus profonde des données (prouvé). **Limite réelle :** le bouton « Génération suivante » suit toujours `children[0]` (aîné). Si une branche profonde n'est pas sous l'aîné, le **bouton** peut s'arrêter avant — mais on atteint la génération en **cliquant le nœud enfant** voulu (clic = focus). **BUG : mineur (affordance).** **FIX :** acceptable tel quel ; documenter que les nœuds enfants sont cliquables. Optionnel : faire pointer le bouton vers l'enfant au sous-arbre le plus profond.

### 4. PersonPanel — onglets Famille/Relations — **PAS de bug**

`tab==='family'` rend `FamilySection` pour conjoints / parents / enfants / frères-sœurs (via `getSpouses/getParents/getChildren/getSiblings`), + avertissements d'incohérence + gestion des relations brutes. Données correctes. **BUG : aucun.**

### 5. Mode Complet — affichage des 57 membres TEDA — **dépend des données / racine**

`TreeView.placeFamily(rootId)` recurse **tous les descendants** du root, et pour le root **uniquement** ses parents + grands-parents (2 niveaux d'ascendance). `rootPersonId = teda-p9 = TEDA FOTIE` (le **fondateur**) → tous les 57 sont ses descendants → tous rendus **si les données sont complètes**. **BUG : pas de bug si la donnée est complète et le root est le fondateur.** Risque résiduel : si la racine configurée n'est PAS le fondateur, les ancêtres au-delà des grands-parents ne s'affichent pas en Complet. **FIX :** vérifier les données (même cause que #1) ; (durcissement code possible, P2) étendre la remontée d'ascendance à la chaîne complète.

> **Synthèse bugs :** Les 5 « bugs » se réduisent à **un seul vrai problème : les données TEDA ne sont pas entièrement chargées dans la session** (P0 données, hors périmètre agent). Aucun **plafond de génération** ni **limite de requête** dans le code (prouvé). Le seul correctif **code** légitime issu de l'investigation est l'affordance du fil d'Ariane (voir Arbre).

---

## B. AUDIT UX/UI PAR SURFACE

### Dashboard — **SCORE 8.5/10**
BUG : aucun. UX (mineur) : « Accès rapide » réduit à 4 ✓ ; reste dense mais bien groupé. FIX : tester le hero avec un nom d'arbre long (overflow potentiel du `clamp`).

### Arbre — Focus — **SCORE 8/10**
BUG (mineur) : fil d'Ariane libellé par **nom de famille** → « DUPONT > DUPONT > DUPONT » illisible quand le patronyme se répète (cas TEDA). UX (majeur) : c'est le repère de lignée principal, il doit distinguer les personnes. FIX : libeller le fil d'Ariane par **prénom** (distinct), ex. « TEDA > MEGNIGUE > DEMANOU ». UX (mineur) : bouton « Génération suivante » suit l'aîné (cf. bug #3).

### Arbre — Complet — **SCORE 8/10**
BUG : aucun (rendu = données). UX (mineur) : nœuds SVG tronquent les noms longs ; minimap utile. FIX : RAS hors données.

### Personnes (liste) — **SCORE 8.5/10**
BUG : aucun. UX : grille de cards lisible, contraste AA (corrigé V1). FIX : RAS.

### Fiche personne (PersonPanel) — **SCORE 8/10**
BUG : aucun (onglets Famille OK). UX (mineur) : 10 onglets, désormais **libellés** (corrigé) ; beaucoup d'info empilée. FIX : envisager regroupement (P2).

### Chronologie — **SCORE 8.5/10**
BUG : aucun. UX : ligne centrale + cards alternées, icônes avec `aria-label`/`title` (corrigé V1-P3). FIX : RAS.

### Journal — **SCORE 8/10**
BUG : aucun. UX : un seul marqueur gauche (corrigé), largeur de lecture bornée. FIX : vérifier l'état vide sur arbre neuf.

### Anniversaires — **SCORE 8/10**
BUG : aucun. UX : compteur de jours en or (corrigé), groupes par mois clairs. FIX : RAS.

### Galerie — **SCORE 8/10**
BUG : aucun. UX : excellent état vide. FIX : vérifier cibles tactiles ≥44px en grille peuplée (mobile).

### Statistiques — **SCORE 8/10**
BUG : aucun. UX : chiffres en or, 0 en gris (corrigé), graphes sobres. FIX : RAS.

### Paramètres — **SCORE 8.5/10**
BUG : aucun. UX : thème actif lisible (bordure or + badge), danger en ghost rouge. FIX : RAS.

### Sidebar — **SCORE 9/10**
BUG : résolu (mobile complet). UX : blocs nets VUE/EXPLORER/GÉRER, actif net, Paramètres épinglé. FIX : RAS.

### Modals (Ajouter personne, Mes arbres) — **SCORE 8/10**
BUG : aucun. UX : titre Spectral, étapes en chips or, champs avancés repliés, TreeAvatar. **Interaction-design :** vérifier le piège de focus (`inert`/focus-trap) et la fermeture Échap. UX (mineur) : champ date natif (format selon navigateur ; indice présent). FIX : confirmer focus-trap + Échap (P2).

---

## C. RÉCAP & PLAN D'ACTION

### Top bugs à corriger immédiatement (P0)
1. **Données TEDA incomplètes en session** (gén. 6 absente, 57 membres potentiellement partiels). **Action (utilisateur, hors agent) :** exécuter les scripts `supabase/teda/update-teda-branche-etendue.sql` + `update-teda-v3-corrections.sql` dans le SQL Editor, puis **resync**. *Le front-end est vérifié sans plafond (preuve Playwright) — aucune correction code ne peut suppléer une donnée absente.*

### Top UX issues (P1)
1. **Fil d'Ariane Focus libellé par nom de famille** → illisible si patronyme partagé. **Fix code :** libeller par **prénom**. *(seul correctif code P1 issu de l'investigation)*

### P2 (prochaine passe)
- Bouton « Génération suivante » : pointer vers l'enfant au sous-arbre le plus profond (sinon documenter que les nœuds enfants sont cliquables).
- Complet : remontée d'ascendance complète (robustesse si racine ≠ fondateur).
- Modals : confirmer focus-trap + fermeture Échap (`inert`).
- PersonPanel : regrouper les onglets si > 7.

### Points forts à préserver
Design system cohérent (indigo-nuit + or, Spectral/Jakarta/mono), distinction genre des nœuds, états vides pédagogiques, feedback (sync/toasts/complétude), i18n FR/EN, reduced-motion, focus-rings.

> **Conclusion honnête :** après 6 passes de correctifs, l'app est saine côté code. L'investigation prouve que **gén. 6 / 57 membres = données, pas code** (aucun plafond ni limite de requête ; navigation testée jusqu'au plus profond). Le seul correctif **code** P1 réel est le **libellé du fil d'Ariane** (appliqué ci-après). Le P0 données nécessite une action SQL côté utilisateur (l'agent n'a pas de `service_role`).
