# Audit d'architecture logicielle — Suimini

**Date** : 16 juillet 2026 · **Périmètre** : monorepo (web Next.js 16 `src/`, mobile Expo `mobile/`, backend hybride Supabase + Railway, storage R2, relais temps réel) · **Méthode** : lecture exhaustive de CLAUDE.md + `docs/`, puis vérification systématique dans le code. Audit en lecture seule, aucun fichier modifié.

**Synthèse** : l'architecture de migration incrémentale (seams + flags + rollback) est d'une qualité remarquable pour un projet de cette taille — mais l'audit révèle que **l'inventaire du périmètre migré est incomplet** : trois chemins de données contournent encore la frontière et écrivent/lisent le backend Supabase figé depuis le cutover du 2026-07-11. Ce sont des bugs de production silencieux, pas des questions de style. Par ailleurs, le « rollback instantané » documenté est en réalité périmé depuis le jour du cutover, et la logique d'autorisation existe désormais en 4 exemplaires sans test de parité mécanique.

---

## 1. Frontières et abstractions (`DataClient` / `DataStore`)

### 1.1 Verdict d'ensemble : design solide, exécution du cœur exemplaire

- **`DataClient`** (`src/lib/dataClient.ts:20-30`) = choix du transport navigateur (direct vs `/api/data/*`), sélection runtime par cookie + défaut serveur Edge Config, fail-safe `direct`.
- **`DataStore`** (`src/lib/dataStore.ts:56-86`) = choix du backend serveur (Supabase vs Railway), sélection par env `DB_BACKEND` + allowlist.
- Les deux interfaces sont des miroirs explicites, et l'invariant « l'AuthZ tourne sur le même backend que les données » est correctement câblé via `store.authz`.
- `useFamilyStore` est propre : aucune fuite, tout passe par `getDataClient()`. Le seul appel Supabase direct est `getSession()` — hors périmètre par conception.
- `collaboration.ts` suit fidèlement le patron `*Direct(client)` injectable + `*ViaApi()` ; `RailwayStore` réutilise les mappers purs de `supabaseSync`.

### 1.2 🔴 MAJEUR — Le partage par email et le partage public écrivent Supabase en contournant la frontière → fonctionnalité silencieusement cassée depuis le cutover

`ShareModal.tsx:6` importe `shareTree, listShares, unshareTree, getPublicShare, setTreePublic` depuis `supabaseSync.ts` — cinq fonctions qui utilisent le client Supabase **en direct**, sans variante `*ViaApi` ni passage par `getDataClient()`.

**Pourquoi c'est grave.** Depuis `DB_BACKEND=railway` à 100% (2026-07-11), l'AuthZ serveur lit `tree_shares`/`trees.is_public` sur **Railway**. Conséquences :

1. **Un nouveau partage par email ne prend jamais effet** : la ligne atterrit dans le `tree_shares` Supabase (figé), jamais dans celui que lit l'AuthZ. Échec 100% silencieux (l'upsert réussit, l'UI affiche un succès).
2. **`setTreePublic` sur un arbre créé après le cutover** : la ligne `trees` n'existe pas dans Supabase → `UPDATE` matche 0 ligne → le lien public ne fonctionnera jamais, sans erreur.
3. **La page publique `/arbre/[slug]` sert des données figées au 2026-07-11** : toute édition post-cutover est invisible sur le lien public.

**Contexte.** Le doc de migration liste bien `tree_shares` dans les tables copiées, mais l'inventaire des chemins de CODE migrés ne couvre que la sync d'arbre, la collaboration, les 6 RPC et `inviteMember`. Le partage « legacy » par email et le partage public ont échappé à l'inventaire — probablement parce qu'ils vivent dans `supabaseSync.ts` et non dans `sharing.ts`/`collaboration.ts`.

**Recommandation.** Ajouter au `DataStore` les 5 opérations + un endpoint `GET /api/data/public/[slug]` (prévu dans le design Phase 0, jamais livré). Entre-temps : désactiver ou bannir l'UI de partage par email pour ne plus écrire dans une base morte, et décider si les lignes écrites dans Supabase depuis le 11/07 doivent être re-copiées vers Railway.

### 1.3 🔴 MAJEUR — Le flux d'invitation anonyme (`/invite/[token]`) lit Supabase alors que les invitations sont écrites sur Railway

`src/app/invite/[token]/page.tsx:42` appelle `getInvitation(token)` → RPC Supabase. Pour un visiteur non connecté, le défaut serveur renvoie `direct` (documenté comme protection : « anonyme → toujours direct… protège /invite pré-login ») → lecture du `tree_members` **Supabase**.

Or les invitations sont désormais écrites sur **Railway**. Un nouvel invité qui clique le lien d'email avant d'être connecté verra « invitation invalide » : le token n'existe que dans Railway. Le commentaire justificatif (`railwayStore.ts:438-440`, « l'appel anonyme reste sur Supabase, ce chemin ne sert qu'un appelant allowlisté ») date de l'ère canary — l'allowlist a été retirée depuis, la justification est périmée et le trou est devenu un vrai bug d'onboarding, sur le chemin le plus critique d'un produit collaboratif.

**Recommandation.** Autoriser explicitement `get_invitation` en RPC anonyme sur `/api/data/rpc/get_invitation`, servie par le store, et faire pointer le client vers l'API même hors session. Test négatif : token inexistant → invalide ; token Railway → visible pré-login.

### 1.4 🟡 MINEUR — Canaux realtime et routes annexes encore branchés sur les tables Supabase mortes

- `subscribeComments` écoute `postgres_changes` sur `person_comments` Supabase — les commentaires sont écrits sur Railway → le live-comment ne se déclenche plus jamais. Non documenté (contrairement au canal principal, dont l'inopérance est connue et contournée).
- `/api/export-pdf` lit `trees`/`persons`/`relationships` Supabase en direct → livret généré sur des données figées.
- `/api/push/notify-join` et `/api/send-approval-email` lisent `trees` Supabase → pour un arbre créé post-cutover, la notification échoue silencieusement.
- `fetchMembers` (`sharing.ts:56-65`) n'a aucun appelant — code mort à supprimer.

**Recommandation.** Une passe d'inventaire mécanique : interdire (règle de lint ou test pure-logic qui grep le code) toute référence aux tables du data-plane hors `supabaseSync.ts`/`authz.ts`/`dataStore.ts`/routes serveur. C'est le garde-fou qui aurait attrapé §1.2, §1.3 et §1.4 d'un coup.

---

## 2. Duplication web/mobile

**Quantification** (logique métier hors UI) : `mobile/lib`+`mobile/hooks` ≈ 2 100 lignes en miroir de `src/`.

**Évaluation : choix raisonnable, dette déjà activement réduite au bon endroit.** La duplication la plus dangereuse (mappers + logique de sync) a été éliminée le 2026-07-12 : le mobile a cessé de parler à Supabase directement pour passer par `/api/data/*`, précisément parce qu'un bug de désynchronisation réel s'était produit (edits web jamais visibles sur mobile). Preuve que le risque est concret et déjà advenu, et que la réponse (converger sur l'API, pas partager du code) fonctionne.

**Dérive résiduelle** : `Person` mobile n'a ni `media?: Media[]` ni `photoTags?: PhotoTag[]` (présents côté web). `preserveExtra` côté serveur protège ces champs d'un écrasement, mais rien ne teste cette protection pour ces champs précis.

**Sévérité : mineur aujourd'hui, s'aggravera linéairement avec les features.** Recommandations : test pure-logic de parité de forme (`Person` web vs mobile) ; ne pas sur-outiller (package partagé) tant que seuls 2-3 fichiers sont concernés.

---

## 3. Couplage RLS ↔ `authz.ts`

**État réel : il n'y a plus 2 sources de vérité, il y en a 4** : les policies RLS SQL, `createSupabaseAuthzProvider`, `createRailwayAuthzProvider`, et la clause de visibilité ré-implémentée en SQL brut dans `RailwayStore.loadTrees` et `canManageMembers` (qui ne passent pas par les prédicats `authz.ts`).

**Garde-fous existants** : `e2e/authz.spec.ts` est un excellent test (table de vérité data-driven), mais il valide les prédicats contre un provider en mémoire, jamais la parité entre les 3 implémentations réelles. Le seul test qui touche le vrai Railway (`railway-store.spec.ts`) est self-skip et **n'est pas dans la CI** (le secret requis n'y est pas configuré). Aucun lien bidirectionnel documenté entre le SQL et `authz.ts`.

**Évaluation du risque** : le passage à 100% Railway a réduit le risque de dérive continue (RLS n'évolue plus) mais augmenté l'enjeu de chaque erreur : sans RLS en filet, un bug de provider = fuite inter-locataire directe. **Sévérité : majeur préventif** (aucune divergence constatée aujourd'hui ; les trois copies sont actuellement alignées).

**Recommandations** : test de parité pure-logic entre les deux providers ; brancher `railway-store.spec.ts` en CI ; commentaire de lien inverse dans `supabase/sharing.sql` et `railway/schema.sql`.

---

## 4. Stratégie de tests

**Inventaire** : 31 specs `e2e/` + 2 `e2e/integration/`. ~11 specs navigateur, ~20 pure-logic.

**Évaluation : cohérente et bien dimensionnée.** Le ratio pure-logic/navigateur est adapté à une app dont le risque n°1 est la logique de sync/merge/authz. `a11y.spec.ts` en garde-fou WCAG est au-dessus de la moyenne.

**Zones critiques sans couverture** :
1. Les route handlers `/api/data/*` eux-mêmes (AuthN 401 / AuthZ 403 / happy-path) — prévu dans le design Phase 0, jamais livré. C'est là que vit l'unique AuthZ post-RLS.
2. Les migrations (validation manuelle uniquement, pas de job CI).
3. Exactement le périmètre du §1 (`loadPublicTree`, `shareTree`, flux `/invite`) — corrélation non fortuite : les chemins non testés sont ceux qui ont dérivé.
4. `railway-store.spec.ts` jamais exécuté en CI.

---

## 5. Migrations SQL (double système)

Le framework versionné Supabase (`supabase/migrations/` + `scripts/migrate.mjs`) est propre et à jour (vérifié par sondage). Les miroirs racine sont actuellement synchronisés, mais la discipline est purement manuelle.

**Le vrai angle mort : Railway n'a aucun système de migration.** `railway/schema.sql` est appliqué manuellement via `psql`, sans versionnage ni tracking, pour le schéma qui porte désormais 100% des données de production. **Sévérité : majeur latent.**

**Recommandations** : créer `railway/migrations/` en réutilisant `migrate.mjs` (pointé sur l'URL unpooled Railway) ; pour le double système Supabase, geler officiellement les miroirs racine (bandeau « historique, ne plus éditer ») ou ajouter un check CI de dérive.

---

## 6. Scalabilité (croissance 10×)

**Ce qui tient** : virtualisation TreeView réelle (coût de rendu indépendant de la taille de l'arbre) ; PgBouncer + pool dimensionné confortablement ; rate-limit IA durable pour les connectés.

**Points de rupture prévisibles** :
1. **🟠 Majeur à 10× : écriture O(taille de l'arbre) à chaque édition.** `saveTree` ré-upserte l'arbre entier à chaque CRUD. À 70 personnes invisible ; à 1000+, chaque édition = ~1000 lignes upsertées. Le mobile a déjà la solution (patch, pas snapshot complet) — porter ce modèle au web.
2. **🟠 Lecture O(tout) amplifiée par le resync-au-focus.** Chargement intégral de tous les arbres à chaque GET, retiré à chaque retour de focus >10s. La vraie réponse est déjà écrite : activer le relais LISTEN/NOTIFY (code posé, inerte).
3. **🟡 localStorage comme cache intégral** — plafond ~5Mo atteignable avec photos base64 + gros arbres.
4. **🟡 Relais realtime** : une seule connexion LISTEN — SPOF assumé et documenté, sans importance tant que le fallback existe.

---

## 7. Cohérence des conventions

- `src/lib/` : 42 fichiers à plat mélangeant utilitaires purs, clients réseau, et modules server-only. Protection contre un import server-only côté client = discipline/commentaires, pas le marqueur `import 'server-only'` de Next. **Mineur** : l'ajouter (une ligne par fichier concerné) rendrait l'erreur impossible au build.
- **Nommage historique trompeur** : `supabaseSync.ts` contient les mappers utilisés par Railway ; le partage est éclaté entre 3 fichiers. C'est très plausiblement la cause racine du §1.2 — les passes de migration ont traité `sharing.ts`/`collaboration.ts`, pas le fond de `supabaseSync.ts`.
- Séparation server/client Next : correcte partout où vérifiée.
- **Cohérence positive à souligner** : le patron « seam + impl passe-plat + impl neuve + flag + rollback » est appliqué identiquement cinq fois (DataClient, DataStore, StorageProvider, memberships, realtime) — une vraie convention d'architecture, rare et précieuse.

## 8. Dette technique explicite

Zéro `TODO`/`FIXME`/`HACK` dans le code — la dette vit dans 23 avertissements `⚠️` répartis dans 17 fichiers, tous des invariants à ne pas casser plutôt que des « à faire ». Dette réelle non marquée trouvée par lecture : `fetchMembers` mort, commentaire périmé « appelant allowlisté », `sharedByName` en dur côté Railway (régression cosmétique vs Supabase).

## 9. Santé de la documentation

**CLAUDE.md : 305 lignes mais ~61 Ko** — équivalent d'un document de 1500 lignes normales. Passé du statut « guide » à « journal de bord compressé ». Dérives constatées vs le code réel : palette Design (« braise chaude » vs `--bg: #0f1a24` Marine Deep réellement en place), compteur de composants, contradiction interne sur le rate-limit narrative (3/h vs 10/h — le code dit 10), Storage R2 live en prod absent d'une section dédiée, AUDIT-V4.md cité comme référence alors qu'obsolète (remplacé par AUDIT-V5.md).

**Verdict : encore un outil de travail efficace** (la densité d'invariants « pièges connus » est précieuse et exacte — tous ceux vérifiés dans cet audit étaient justes), **mais il a dépassé le seuil où sa section « état courant » est fiable.** Recommandation : séparer strictement invariants (stables, restent dans CLAUDE.md) et état/journal (dates, pourcentages) qui devraient vivre dans un `docs/STATUS.md` daté, réécrit à chaque changement d'état.

## 10. Rollback story

| Levier | Mécanisme | Verdict |
|---|---|---|
| Transport (Edge Config) | instantané, sans redeploy | ✅ mécaniquement sûr, mais voir ci-dessous |
| Backend (`DB_BACKEND`) | redeploy | ✅ |
| Memberships | redeploy, court-circuité proprement | ✅ |
| Storage (R2) | build-time | ⚠️ voir ci-dessous |
| Realtime | inerte, additif | ✅ le plus propre des cinq |

**🔴 MAJEUR — Le rollback data « une ligne » est périmé depuis le jour du cutover, et le doc ne le dit pas.** Un rollback aujourd'hui renverrait tous les utilisateurs sur des arbres amputés des jours d'éditions qui ne vivent que dans Railway — et l'architecture local-first aggraverait le chaos (des clients rolled-back pourraient ré-upserter partiellement leur cache récent dans Supabase, créant une troisième version des données). Le rollback n'est « une ligne » que couplé à une re-copie Railway→Supabase préalable — qui n'existe nulle part. **Recommandation** : requalifier le rollback en « frein d'urgence avec perte de données assumée » dans le doc, et écrire le script de copie inverse.

**🟠 Storage : le rollback est partiellement fictif depuis la réécriture des URLs.** Depuis le script de réécriture des URLs photo vers R2, retirer le flag ne re-route que les nouveaux uploads ; l'existant dépend de R2 quoi qu'il arrive. Le domaine public est `pub-*.r2.dev` (URL « Development » Cloudflare, non recommandée en prod) — passer sur un domaine custom avant que ça compte.

**Recommandation transversale** : `/admin/health` existe déjà — lui faire afficher (et colorer en rouge) toute combinaison de flags incohérente (ex. `DB_BACKEND=railway` + `data_layer.default=direct`) serait un garde-fou à coût quasi nul.

---

## Tableau récapitulatif des findings

| # | Finding | Sévérité |
|---|---|---|
| F1 | Partage email + partage public écrivent/lisent Supabase figé — fonctionnalités cassées ou périmées | **Majeur (bug prod)** |
| F2 | `/invite/[token]` anonyme lit Supabase, invitations écrites sur Railway | **Majeur (bug prod)** |
| F3 | Rollback Edge Config devenu destructif, pas de script de copie inverse | **Majeur** |
| F4 | AuthZ en 4 exemplaires sans test de parité ; tests Railway jamais en CI | **Majeur (préventif)** |
| F5 | Railway sans framework de migrations versionnées | **Majeur (latent)** |
| F6 | Écriture/lecture O(arbre entier) — points de rupture à 10× | **Majeur (horizon)** |
| F7 | Route handlers `/api/data/*` sans tests 401/403/happy-path | Majeur/mineur |
| F8 | Canaux/routes annexes branchés sur tables Supabase mortes | Mineur |
| F9 | Rollback Storage partiellement fictif ; domaine R2 dev en prod | Mineur/majeur |
| F10 | CLAUDE.md : état courant dérivé du code ; AUDIT-V4 obsolète cité en référence | Mineur |
| F11 | Duplication mobile ~2100 lignes, dérive `Person` sans test de parité | Mineur |
| F12 | `src/lib` sans `import 'server-only'` ; nommage partage éclaté (cause probable de F1) | Mineur |
| F13 | Code mort, commentaires périmés, valeur en dur régressive | Observation |
| F14 | Double système migrations Supabase (à jour mais manuel) | Observation |

**Recommandation transversale n°1**, qui aurait prévenu F1, F2 et F8 et empêchera leurs successeurs : un test pure-logic « inventaire de frontière » qui échoue si un fichier hors liste blanche référence une table du data-plane.
