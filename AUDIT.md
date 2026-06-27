# Audit UI/UX — Suimini (application web)

**Date :** 2026-06-27 · **Périmètre :** app connectée (`/app`), pas la landing
**Build audité :** `main` @ `9413d08` (design « Modern Heritage » indigo-nuit, Spectral + Plus Jakarta Sans + IBM Plex Mono)
**Méthode :** heuristiques de Nielsen (0-4), charge cognitive (Miller/Cowan ≤4), personas (Jordan/Sam/Casey/Alex/Riley), WCAG 2.1 AA, + bans anti-slop du registre *product* (skill `impeccable` ; les skills `uiux-audit`/`uiux-audit-senior` demandés sont absents du dépôt et de `/mnt/skills`, méthodo dérivée de `impeccable/reference/audit.md` + `critique.md`).
**Note :** audit seulement — aucun fichier de code modifié. Capté via Playwright (desktop 1440×900 + mobile 390×844, mode démo « Famille Dupont »).

---

## Vue d'ensemble (verdict anti-slop)

Pas un rendu « AI slop ». Le système est **distinctif et cohérent** : fond indigo-nuit, or terracotta réservé à l'accent, serif éditorial (Spectral) pour les titres/chiffres, sans humaniste (Jakarta) pour l'UI, mono (IBM Plex) pour dates/labels. Bordures pleines (pas de side-stripe décoratif sauf usage intentionnel sur Dashboard/Journal), zéro gradient text, zéro glassmorphism, zéro grille de cartes génériques. Les vrais problèmes sont **structurels et d'accessibilité**, pas esthétiques.

Les 6 défauts les plus rentables à corriger sont transverses (double en-tête, contraste du gris fin, onglets icon-only, collision mobile, carte claire, date non localisée) — les régler remonte presque toutes les pages d'un cran.

---

## 1. Dashboard (Accueil)

**SCORE : 8.5/10**

**PROBLÈMES CRITIQUES :** aucun.

**PROBLÈMES MAJEURS :**
- Densité d'entrée : 1 hero + 2 CTA + 3 grandes stats + 3 cartes (Anniversaires / Activité / Accès rapide) = beaucoup au premier écran. Hiérarchie OK mais frôle le « wall of widgets » (charge cognitive : ~6 zones de décision).

**PROBLÈMES MINEURS :**
- « Accès rapide » duplique la navigation latérale (Arbre/Personnes/Carte/Chronologie/Journal/Statistiques déjà dans la sidebar) → redondance, faible valeur ajoutée.
- Le hero `display` « Famille Dupont » (clamp jusqu'à ~5rem) est très grand ; sur une ligne ça va, mais un nom d'arbre long risque l'overflow (à tester avec « Famille de Saint-Exupéry »).

**RECOMMANDATIONS (priorisées) :**
1. (P2) Réduire « Accès rapide » à 2-3 raccourcis réellement utiles (ex. Ajouter, Chronologie, Galerie) ou le fusionner avec les CTA hero.
2. (P3) Tester le hero avec un nom long ; plafonner le clamp si overflow.
3. (P3) Hiérarchiser : 1 carte primaire (Activité) + 2 secondaires plus discrètes.

---

## 2. Vue Arbre (Focus + Complète)

**SCORE : 8/10**

**PROBLÈMES MAJEURS :**
- **Troncature des noms trop agressive** sur les nœuds Focus (« Henri Dupo… », « Marguerite … », « Thomas Du… »). Le nœud fait 200px ; « Henri Dupont » devrait tenir. Cause : `ft-name` en `white-space: nowrap` + ellipsis à ~16px Spectral, avatar 58px qui mange la largeur. Perte d'information sur l'élément central de l'app.
- **Découvrabilité Focus↔Complète** : le toggle est clair, mais le double-clic (focus close-family en mode Complète) et le clic (ouvre le panneau) ne sont pas signalés (aucune affordance / aide). Persona Jordan : ne devinera pas le double-clic.

**PROBLÈMES MINEURS :**
- En mode Complète, les puces de complétude/sources/photos en coin de carte sont petites (<16px) — décoratives, OK, mais peu lisibles.
- Le libellé de bande « GÉNÉRATION N » et le tag « GÉN. N » coexistent : léger doublon d'information (acceptable, l'un situe la rangée, l'autre la carte).

**RECOMMANDATIONS :**
1. (P1) Élargir la zone nom des nœuds Focus (réduire avatar à ~48px ou nom sur 2 lignes prénom/nom déjà séparés ; baisser la police à 15px) pour éviter la troncature des noms courants.
2. (P2) Ajouter une micro-aide (tooltip « double-clic = recentrer », ou un hint au survol) pour les interactions cachées.
3. (P3) Uniformiser la densité des puces de coin (taille tap ≥ visibilité).

---

## 3. Liste Personnes

**SCORE : 8.5/10**

**PROBLÈMES MAJEURS :**
- **Double en-tête** (voir problème systémique #1) : `ContentHeader` affiche « FAMILLE DUPONT / Personnes » puis la vue répète « Personnes | Famille Dupont » + barre Filtres/Trier/Ajouter. Deux titres pour la même page → bruit, hiérarchie diluée. Le bouton « Ajouter » apparaît aussi 2-3 fois (sidebar + header + barre liste).
- **Contraste** : lieu (`lv-place`, `--text-light` #6c6c82, ~10.5px) ≈ 3.2:1 sur carte #1e1e28 → **sous le seuil WCAG AA 4.5:1** pour du petit texte.

**PROBLÈMES MINEURS :**
- À 1440px la grille fait 4 colonnes (spec « 3 max ») — pas un défaut en soi, mais `minmax(248px)` peut donner des cartes un peu serrées ; OK.
- Tags genre/statut en double (FEMME + VIVANT) sur chaque carte : utile, mais ajoute du bruit visuel sur 19 cartes.

**RECOMMANDATIONS :**
1. (P1) Remonter le lieu/dates secondaires vers `--text-muted` (#9094a6, AA) au lieu de `--text-light`.
2. (P2) Supprimer le sous-titre de vue redondant ; garder l'`ContentHeader` comme seul titre + la barre d'outils.
3. (P3) Envisager 1 seul tag (statut) + couleur d'avatar pour le genre (déjà encodé), pour alléger.

---

## 4. Fiche Personne / PersonPanel

**SCORE : 7/10** (le point faible relatif)

**PROBLÈMES MAJEURS :**
- **Barre d'onglets 100 % icônes, sans libellés** (8 onglets : profil / chrono / relations / événements / docs / bio / galerie / sources). Viole « Recognition rather than recall » et pénalise Jordan (premier venu) **et** Sam (lecteur d'écran : des `aria-label` peuvent exister, mais visuellement aucun repère). 8 cibles = au-delà de la limite de mémoire de travail (≤4).
- **Densité** : panneau riche (anneau de complétude 83 %, suggestions, naissance, décès, contexte historique, profession, bio) — beaucoup d'infos empilées ; la hiérarchie repose surtout sur les eyebrows mono, peu de respiration.

**PROBLÈMES MINEURS :**
- L'anneau de complétude « 83 % » en haut-gauche est petit et déconnecté du bloc Suggestions qui répète l'info.
- Icônes éditer/supprimer/fermer en haut-droite, sans libellé non plus (mais tooltips probables).

**RECOMMANDATIONS :**
1. (P1) Ajouter des libellés aux onglets (ou réduire à 4-5 onglets + « Plus »), ou passer en sections déroulantes plutôt que 8 onglets icon-only.
2. (P2) Fusionner l'anneau de complétude avec le bloc Suggestions (un seul indicateur).
3. (P3) Aérer : plus d'espace inter-blocs, 1 seul niveau d'eyebrow.

---

## 5. Chronologie

**SCORE : 8.5/10**

**PROBLÈMES MAJEURS :**
- **Double en-tête** (systémique #1) : ContentHeader « Chronologie » + « Chronologie | Famille Dupont ».

**PROBLÈMES MINEURS :**
- 4 contrôles segmentés sur une ligne (Liste/Siècle + Famille/Individu) — clair, mais 4 décisions simultanées ; OK.
- Cartes alternées gauche/droite : élégant en desktop ; vérifier le repli mobile (déjà géré en pleine largeur dans le code).

**RECOMMANDATIONS :**
1. (P2) Dédupliquer le titre (cf. systémique).
2. (P3) L'icône de type (Sparkles/Moon/Heart/Star) pourrait porter un `title`/légende pour les non-voyants (sens porté par l'icône seule).

---

## 6. Journal

**SCORE : 7.5/10**

**PROBLÈMES MAJEURS :**
- **Mise en page sur une seule colonne pleine largeur** : avec une seule entrée, la carte s'étire sur ~950px et laisse un grand vide à droite ; le rail timeline (point + filet) à gauche + la bordure or gauche de la carte font **deux marqueurs gauche** redondants.
- **Double en-tête** (systémique #1).

**PROBLÈMES MINEURS :**
- Pas d'état vide pédagogique visible ici (1 entrée seedée) ; à vérifier sur arbre neuf.
- Les chips @mention sont sobres et réussies ; bon contraste (or sur carte).

**RECOMMANDATIONS :**
1. (P2) Contraindre la largeur de lecture des entrées (~680-720ch visuel) et centrer la colonne, ou retirer le rail timeline OU la bordure or (pas les deux).
2. (P2) Dédupliquer le titre.
3. (P3) Vérifier l'état vide (« Aucune entrée — racontez un souvenir »).

---

## 7. Anniversaires

**SCORE : 8/10**

**PROBLÈMES MAJEURS :**
- **Double en-tête** (systémique #1).

**PROBLÈMES MINEURS :**
- Le compte à rebours (« 17 jours ») est en blanc (`--text`) alors que c'est le chiffre-clé de chaque ligne → incohérent avec la règle « chiffres-clés en or » appliquée ailleurs (Dashboard, Stats).
- Le sens est porté par la couleur d'icône (Commémoration/Anniversaire/Noces) — ajouter le libellé texte (déjà présent ✓) suffit, OK.
- Groupes par mois clairs ; bonne lisibilité.

**RECOMMANDATIONS :**
1. (P2) Mettre le compteur de jours en or (`--accent`/`--accent-text`) pour cohérence des chiffres-clés.
2. (P2) Dédupliquer le titre.

---

## 8. Galerie

**SCORE : 8/10**

**PROBLÈMES MAJEURS :**
- **Double en-tête** (systémique #1) — « Galerie » + « Galerie | Aucune photo ».

**PROBLÈMES MINEURS :**
- **Excellent état vide** (icône, titre Spectral, explication actionnable, CTA or) — à répliquer ailleurs.
- État peuplé non audité (démo sans photos après retrait des avatars cartoon) ; vérifier la grille `minmax(160px)` + cibles tactiles des tuiles ≥44px sur mobile.

**RECOMMANDATIONS :**
1. (P2) Dédupliquer le titre.
2. (P3) Tester la grille peuplée (lazy-load déjà présent) et le contraste de l'overlay au survol.

---

## 9. Statistiques

**SCORE : 8/10**

**PROBLÈMES MAJEURS :**
- **Double en-tête** (systémique #1).

**PROBLÈMES MINEURS :**
- Tous les chiffres sont désormais en or (cohérent ✓). Mais **0 « Avec photo »** s'affiche en or comme une donnée valorisée → un 0 mis en avant peut surprendre (donnée honnête, OK, mais visuellement « 0 » en gros or attire l'œil sur un manque).
- Le nuage de prénoms garde les couleurs genre (bleu/rose) — cohérent avec le sens, mais légère tension avec la consigne « tout en or ». Acceptable (ce sont des noms, pas des chiffres).
- Graphes SVG sobres et lisibles ; barres or principales + bleu-gris secondaires ✓.

**RECOMMANDATIONS :**
1. (P2) Dédupliquer le titre.
2. (P3) Atténuer les métriques à 0 (gris) plutôt qu'or, pour ne pas valoriser un vide.

---

## 10. Paramètres

**SCORE : 8.5/10**

**PROBLÈMES MAJEURS :** aucun.

**PROBLÈMES MINEURS :**
- Bonne refonte : sections Spectral, séparateurs or fins, cards de thème grandes, thème actif lisible (bordure or 2px + fond #252535 + badge « Actif » or), bouton danger « Vider le cache » en ghost rouge ✓.
- La sélection de thème change l'accent **mais pas les surfaces** (indigo fixe) — cohérent avec l'archi dark-only ; juste s'assurer que l'utilisateur comprend que « Bordeaux/Forêt/Marine » ne change que l'accent (le mot « Thème de couleurs » peut sur-promettre).

**RECOMMANDATIONS :**
1. (P3) Préciser le libellé/aide : « Couleur d'accent » plutôt que « Thème de couleurs » (évite l'attente d'un re-skin complet).

---

## 11. Sidebar (navigation globale)

**SCORE : 8.5/10**

**PROBLÈMES MAJEURS :**
- **Clipping vertical** : à 900px de haut, le groupe « GÉRER » (Paramètres/Admin) est partiellement masqué par le bloc d'actions (« GÉRER » coupé). La nav scrolle, mais Paramètres n'est pas visible sans scroll → découvrabilité réduite des réglages.

**PROBLÈMES MINEURS :**
- Réorganisation VUE / EXPLORER / GÉRER claire ✓, libellés visibles ✓, icônes Lucide visibles ✓, état actif net (fond carte + barre or 2px + texte or) ✓.
- Actions rapides (Ajouter + Partager/Import/Imprimer/Exporter) **dupliquent** partiellement les CTA présents dans les vues (Ajouter surtout) — choix assumé (accès persistant), mais c'est de la redondance.
- 11 items de nav + 1 groupe gérer = au-delà de « ≤5 top-level » de Miller, mais le sous-groupage atténue (acceptable pour une app riche).

**RECOMMANDATIONS :**
1. (P2) Garantir la visibilité de « Paramètres » (épingler le groupe GÉRER en bas, hors zone scrollable, ou réduire les paddings).
2. (P3) Évaluer si le bloc actions doit rester complet partout (ex. masquer Import/Export sur petits écrans).

---

## 12. Modals (Mes arbres, Ajouter une personne)

**SCORE : 7.5/10**

**PROBLÈMES MAJEURS :**
- **Champ date natif `mm/dd/yyyy`** dans « Nouvelle personne » alors que la locale est FR → format US trompeur, source d'erreurs de saisie (Riley/Jordan). Localisation du `<input type=date>` ou date-picker FR.
- **Densité du formulaire** : ~10 champs visibles d'un coup à l'étape 1 (Prénom, Nom, Nom de jeune fille, Surnom, Sexe, Date, Lieu, Vivant, Profession, Nationalité, Religion, Éducation, Photo…) → au-delà de « ≤4 champs par groupe ». Le stepper (1 Informations / 2 Relation) aide, mais l'étape 1 est lourde.

**PROBLÈMES MINEURS :**
- « Mes arbres » : le nouveau **TreeAvatar « FD » or** remplace bien l'icône générique ✓ ; arbre actif avec bordure or + « ACTIF » ✓ ; CTA « Créer un nouvel arbre » clair ✓.
- Modal « Nouvelle personne » : seuls Prénom/Nom sont requis (bonne friction minimale) — mais ce n'est pas visuellement évident que le reste est optionnel (tout est présenté au même poids).

**RECOMMANDATIONS :**
1. (P1) Localiser le champ date (format FR `jj/mm/aaaa`) ou intégrer un date-picker localisé.
2. (P2) Regrouper/replier les champs avancés (Nationalité/Religion/Éducation/Photo) sous « Détails (optionnel) » pour réduire la charge à l'étape 1.
3. (P3) Marquer visuellement les champs requis vs optionnels.

---

# Récapitulatif global

## Score moyen

| # | Page | Score |
|---|------|-------|
| 1 | Dashboard | 8.5 |
| 2 | Arbre (Focus + Complète) | 8.0 |
| 3 | Liste Personnes | 8.5 |
| 4 | Fiche / PersonPanel | 7.0 |
| 5 | Chronologie | 8.5 |
| 6 | Journal | 7.5 |
| 7 | Anniversaires | 8.0 |
| 8 | Galerie | 8.0 |
| 9 | Statistiques | 8.0 |
| 10 | Paramètres | 8.5 |
| 11 | Sidebar | 8.5 |
| 12 | Modals | 7.5 |

**Moyenne : ≈ 8.0 / 10** — *« Good : base solide, corriger les axes faibles. »*

## Tableau heuristiques (Nielsen, 0-4) — synthèse app

| # | Heuristique | Score | Point-clé |
|---|-------------|-------|-----------|
| 1 | Visibilité de l'état | 3 | Sync indicator, toasts, complétude, état actif nav — bon |
| 2 | Adéquation monde réel | 3 | Vocabulaire familial juste ; date US en FR = accroc |
| 3 | Contrôle & liberté | 3 | Annuler/fermer présents ; double-clic arbre caché |
| 4 | Cohérence & standards | 3 | Système très cohérent ; double en-tête = incohérence de titrage |
| 5 | Prévention des erreurs | 3 | Champs requis minimaux ; confirmations destructives présentes |
| 6 | Reconnaissance vs rappel | 2 | Onglets PersonPanel icon-only ; interactions arbre cachées |
| 7 | Flexibilité & efficacité | 3 | Palette ⌘K, raccourcis ; bon pour Alex |
| 8 | Esthétique & minimalisme | 3 | Distinctif, mais double en-tête + redondances d'actions |
| 9 | Récupération d'erreurs | 3 | Messages clairs (à vérifier sur formulaires) |
| 10 | Aide & documentation | 2 | Peu d'aide contextuelle / tooltips sur interactions non triviales |
| **Total** | | **28/40** | **Good** |

## Top 5 problèmes les plus urgents

1. **Double en-tête sur 6 vues** (Liste, Chronologie, Journal, Anniversaires, Galerie, Statistiques) — `ContentHeader` + en-tête interne de la vue répètent le titre et parfois le bouton « Ajouter ». *Impact : hiérarchie diluée, bruit, incohérence. (P1, transverse)*
2. **PersonPanel : 8 onglets icon-only sans libellés** — recognition/recall + accessibilité ; cible la fiche, écran le plus consulté. *(P1)*
3. **Contraste WCAG AA** : petit texte gris `--text-light` (#6c6c82 ≈ 3.2:1) pour lieux/dates secondaires sur cartes — sous 4.5:1. *(P1, transverse listes/arbre)*
4. **Mobile : le FAB compte « N » chevauche le 1er onglet du BottomNav (« Arbre »)** — collision de cibles tactiles en bas-gauche. *(P1, mobile)*
5. **Champ date natif `mm/dd/yyyy` en locale FR** (Nouvelle personne) — format trompeur, erreurs de saisie. *(P1)*

*(Bonus transverse : carte Leaflet en tuiles OSM claires qui cassent l'immersion sombre — P1 visuel.)*

## Plan d'action priorisé

### P0 — Bloquant (à corriger immédiatement)
*Aucun.* L'app est fonctionnelle de bout en bout ; aucun défaut n'empêche une tâche.

### P1 — Majeur (à corriger avant release)
- **Supprimer le double en-tête** : faire de `ContentHeader` le seul titre de page ; retirer le sous-titre interne « X | Famille Dupont » de Liste/Chronologie/Journal/Anniversaires/Galerie/Statistiques (garder uniquement les barres d'outils). → `impeccable distill` / `layout`.
- **PersonPanel** : libeller les onglets (ou réduire à 4-5 + « Plus »). → `impeccable clarify` / `layout`.
- **Contraste** : remplacer `--text-light` par `--text-muted` (AA) pour tout texte de corps < 14px (lieux, dates secondaires en `ListView`, `FocusTree`). → `impeccable colorize` (vérif. contraste).
- **Mobile** : désencombrer le coin bas-gauche — déplacer/retirer le FAB compte « N » qui chevauche le BottomNav, ou décaler le 1er item. → `impeccable adapt`.
- **Date localisée** dans `PersonForm` (format FR / date-picker). → `impeccable harden`.
- **Carte** : tuiles sombres (CARTO dark / Stadia) pour cohérence + lisibilité des marqueurs or. → `impeccable colorize`.

### P2 — Mineur (prochaine passe)
- Troncature des noms dans les nœuds Arbre Focus (élargir la zone nom). → `impeccable layout`.
- Sidebar : garantir la visibilité de « Paramètres » (épingler GÉRER hors zone scrollable). → `impeccable layout`.
- Anniversaires : compteur de jours en or (cohérence chiffres-clés). → `impeccable colorize`.
- Journal : contraindre la largeur de lecture + un seul marqueur gauche. → `impeccable layout`.
- Modal personne : replier les champs avancés sous « Détails (optionnel) ». → `impeccable distill`.
- Réduire les redondances d'actions (Ajouter présent 2-3×). → `impeccable distill`.

### P3 — Polish (si temps disponible)
- Dashboard : alléger « Accès rapide » (doublon de la nav).
- Affordances cachées de l'arbre (tooltip double-clic).
- Stats : métriques à 0 en gris plutôt qu'or.
- Paramètres : renommer « Thème de couleurs » → « Couleur d'accent ».
- Légendes/`title` sur les icônes porteuses de sens (chronologie, onglets).

## Points forts à préserver
- **Système de design cohérent et distinctif** (tokens, 3 familles typo bien réparties, or réservé à l'accent, indigo-nuit reposant).
- **États vides pédagogiques** (Galerie surtout) — modèle à répliquer.
- **Feedback d'état** riche (sync, toasts, complétude, présence collaborative).
- **TreeAvatar / PersonAvatar** initiales élégantes par genre — identité visuelle propre, zéro placeholder cassé.
- **i18n FR/EN**, `prefers-reduced-motion` respecté, focus-rings clavier présents.
- **Vue Arbre Focus** : repères de génération (barres de couleur + GÉN. N + bandes) réussis et pédagogiques.

---

## Problèmes systémiques (récurrents)
1. **Double titrage** : `ContentHeader` + en-tête de vue → présent sur ≥ 6 pages. Cause racine unique, correction unique à fort effet.
2. **Texte gris fin sous AA** : `--text-light` employé pour du corps < 14px à plusieurs endroits (cartes liste, nœuds arbre).
3. **Icônes sans libellé** pour des actions/onglets non triviaux (PersonPanel, certaines barres d'outils) — recognition vs recall.
4. **Redondance d'actions** : « Ajouter une personne » apparaît dans la sidebar, le ContentHeader et les barres de vue.

> Méthodologie : `impeccable/reference/audit.md` (5 dimensions techniques) + `critique.md` (heuristiques Nielsen, charge cognitive, personas). Re-lancer l'audit après corrections pour suivre la progression du score (28/40 → cible 34+/40 après P1).
