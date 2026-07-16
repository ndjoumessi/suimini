# Archi F6 — écriture/lecture O(arbre entier) : analyse, pas un correctif

**Statut : analyse et plan écrits, AUCUN changement de code sur le moteur de sync.**
Ce document explique pourquoi, et propose une suite d'actions par ordre de risque
croissant — à valider avant d'entamer quoi que ce soit au-delà de l'étape 1.

## Pourquoi pas un correctif direct

F6 est classé « Majeur (horizon) » dans `AUDIT-ARCHITECTURE.md`, pas un bug actif :
invisible aujourd'hui à la taille réelle des arbres (71 personnes max, TEDA), il
deviendrait un problème réel à une croissance ×10+. Ce n'est pas la même urgence
que F1/F2/F3 (bugs de prod actifs, déjà corrigés cette session) — rien ne casse
aujourd'hui.

Le code concerné (`saveTreeToSupabase`/`pushChildTable` dans `supabaseSync.ts`,
repris à l'identique par `RailwayStore.saveTree`) est aussi le code dont une
refonte précédente (passage du DELETE-par-diff au soft-delete-only) **a causé
l'incident de production TEDA** documenté dans `CLAUDE.md` (§ Synchronisation).
Le réécrire à l'aveugle, sans base Railway/Supabase réelle pour rejouer les
scénarios de conflit (edit-vs-edit, delete-vs-edit, résurrection de tombstone,
`preserveExtra`), reproduirait exactement les conditions du dernier incident.
Cet agent n'a ni credentials Railway/Supabase de test, ni la possibilité de
lancer les 31 specs `e2e/` contre un vrai backend cloud (elles tournent
pure-logic, contre de faux clients). Un refactor du moteur de sync mérite un
vrai passage en staging avant merge — hors de portée ici.

## Constat précis (code lu, 2026-07-16)

- **Écriture** : `pushChildTable(table, rows, client)` (`supabaseSync.ts:211-232`)
  reçoit `tree.persons`/`tree.relationships`/`tree.journal` **au complet** à
  chaque sauvegarde et fait `client.from(table).upsert(payload)` — UN appel
  réseau par table (pas un aller-retour par ligne, donc pas O(n) en nombre de
  *requêtes*), mais bien O(n) en **volume de données transférées et de lignes
  réécrites côté Postgres**, y compris les lignes inchangées depuis le dernier
  push.
- **Déclenchement** : `useFamilyStore.ts:523` calcule
  `activeTreeKey = JSON.stringify(activeTree)` à **chaque rendu** — un coût
  supplémentaire O(taille de l'arbre) en CPU/mémoire navigateur, indépendant du
  réseau, qui n'était pas explicitement chiffré dans l'audit d'origine.
  Debounce 0–700 ms (`useFamilyStore.ts:541-543`) : CRUD explicite = quasi
  immédiat, édition implicite = 700 ms — dans les deux cas, la charge utile
  reste l'arbre entier.
- **Lecture** : chargement intégral de tous les arbres au boot + au retour de
  focus après >10 s d'inactivité (mécanisme documenté dans `docs/sync-internals.md`
  comme palliatif à l'absence de temps réel fonctionnel côté Railway).
- **Mitigations déjà présentes dans le repo, mais partielles** :
  1. **Modèle patch mobile** (`mobile/lib/store.ts:116-141`, `upsertPerson` →
     `upsertPersonRemote`) écrit **une seule personne** par appel — modèle
     prouvé en production côté mobile, jamais porté au web.
  2. **Relais realtime Railway** (LISTEN/NOTIFY → WebSocket,
     `scripts/realtime-relay/`) : code écrit, testé en pure-logic, **mais
     inerte** (trigger SQL non appliqué, relais non déployé, flags éteints —
     voir `docs/railway-realtime-plan.md`). Une fois activé, il supprimerait le
     resync-au-retour-de-focus (plus besoin de recharger l'arbre entier « au
     cas où » — un signal WebSocket dirait exactement quand un rechargement est
     nécessaire) : ça règle la moitié **lecture** du problème, pas l'écriture.

## Ce qu'impliquerait un vrai portage du modèle patch au web

Remplacer l'upsert-de-tout par un diff local (quels persons/relationships/
journal ont réellement changé depuis le dernier push) + upserts ciblés,
mirroring le modèle mobile déjà en prod. Concrètement, ça toucherait :

- `useFamilyStore.ts` : remplacer `pushTreeNow` par un calcul de diff avant
  chaque push (déjà une ébauche existe : `knownIdsRef`, ligne 513, sert
  aujourd'hui à détecter les DELETES par diff d'ids — l'étendre à détecter les
  UPDATES par `updatedAt` réduirait le principal risque).
- `supabaseSync.ts`/`railwayStore.ts` : `pushChildTable` resterait valable pour
  un sous-ensemble de lignes ; le vrai changement est en amont, dans QUI
  appelle avec QUOI.
- Le mécanisme de résolution de conflit (`syncMerge.ts`, `conflictQueue.ts`,
  `mergeTreeFavoringLocal`) : actuellement pensé pour un hard-replace/merge
  d'ARBRE ENTIER (F5 même-session, login) — un modèle patch introduit une
  troisième surface de conflit (un patch partiel qui arrive après qu'un autre
  appareil a déjà tout remplacé) à raisonner et tester spécifiquement.
- Risque principal identifié : la classe de bug de l'incident TEDA (perte
  silencieuse de données via une écriture partielle mal bornée) redeviendrait
  possible si le diff local se trompe (id manquant, `extra` mal préservé sur
  une ligne non incluse dans le patch).

## Recommandation — ordre d'action

1. **Activer le relais realtime (déjà codé)** — risque le plus bas, ne touche
   pas au moteur d'écriture, retire la cause principale des lectures répétées
   pleine-taille. Nécessite : appliquer `railway/realtime-notify.sql` (ou
   `railway/migrations/0001_schema.sql`, qui l'inclut déjà) sur l'URL unpooled,
   déployer `scripts/realtime-relay/`, poser les flags
   `NEXT_PUBLIC_REALTIME_BACKEND`/`EXPO_PUBLIC_REALTIME_BACKEND` — toutes
   actions qui nécessitent des credentials/déploiement que cet agent n'a pas.
2. **Instrumenter avant de refactorer** : logger (ou exposer dans
   `/admin/health`) le nombre de lignes réellement upsertées par push et la
   taille moyenne d'arbre en prod — remplacer l'estimation « à 1000+ » de
   l'audit par des chiffres réels avant d'investir dans un refactor.
3. **Porter le modèle patch au web, DERRIÈRE UN FLAG**, seulement après (1) et
   (2), avec un passage de test contre un vrai environnement (staging Railway/
   Supabase) — pas seulement pure-logic — étant donné l'historique de
   l'incident TEDA sur ce même sous-système.

**Aucune de ces trois étapes n'a été commencée dans ce commit** — la 1 et la 3
nécessitent des décisions/accès que cet agent n'a pas ; la 3 nécessite en plus
un feu vert explicite étant donné le risque, par analogie avec la manière dont
le passage à 100% Railway (2026-07-11) et le flip du storage R2 ont chacun
demandé une décision explicite de l'utilisateur avant exécution.
