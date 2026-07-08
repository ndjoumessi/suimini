# Phase 0 — Couche d'accès données serveur (design)

> **Statut : design, à valider. Aucun code écrit.**
> Prérequis à la migration DB (Railway) — mais a une **valeur propre** :
> centralise tout l'accès données derrière une API, prépare l'abandon de RLS,
> réduit le lock-in. Rollbackable à 100 % (feature flag).

## 1. Objectif & non-objectifs

**Objectif.** Faire passer **tout** read/write de données par des **route
handlers Next.js** (`/api/data/*`) : `navigateur → notre API → Supabase`. En
sortie de phase, plus **aucun** `supabase.from('table')` ni `.rpc()` côté client
web. L'API porte une **couche d'autorisation** en miroir des 29 policies RLS,
de sorte que le jour où RLS disparaît (Railway), rien ne casse.

**Non-objectifs de la Phase 0 (différés, voir §9).**
- ❌ Migrer la DB (reste Supabase).
- ❌ Changer l'Auth (reste Supabase Auth ; le JWT identifie l'appelant).
- ❌ Realtime → Pusher (les `postgres_changes` restent directs tant que la DB
  est chez Supabase — ils déménageront **avec** la DB).
- ❌ Storage → R2 (l'upload avatar reste direct pour l'instant).
- ❌ **Mobile** (l'app native continue de parler à Supabase en direct — voir §8,
  contrainte « on ne force pas une MAJ native »).
- ❌ Réécrire la logique interne des 16 RPC (l'API les **forwarde** ; leur
  logique migrera au moment Railway).

**Zéro changement fonctionnel visible.** Le modèle *local-first optimiste*
(localStorage + push débouncé + soft-delete + merge favor-local + résolution de
conflits) est **préservé** : seul le **transport** change (voir §6).

## 2. Architecture actuelle (rappel)

Navigateur (et mobile) parlent **directement** à Supabase avec la **clé anon** ;
**RLS** isole les locataires. Surface mesurée (diagnostic précédent) :

| Élément | Ampleur |
|---|---|
| `.from('table')` directs (client) | **49 sites / 11 fichiers** |
| RPC | **16** |
| Policies RLS + `can_read_tree`/`can_write_tree` | **29** |
| Realtime (`postgres_changes`) | 4 fichiers |
| Storage (`avatars`) | 3 sites |
| Auth (`supabase.auth.*`) | 19 web + mobile |

Cœur data client : `src/lib/supabaseSync.ts` (mappers + `loadTreesFromSupabase`,
`saveTreeToSupabase`, `pushChildTable`, `deleteChildRows`, `detectDeleteConflicts`,
`preserveRemoteExtra`, `loadPublicTree`…) piloté par `src/hooks/useFamilyStore.ts`.
`src/lib/sharing.ts` (RPC partage), `src/hooks/useAdminData.ts` (RPC admin),
`src/hooks/useAuth.ts` (profil).

## 3. Architecture cible Phase 0

```
Navigateur ──HTTP(JSON)──▶ /api/data/*  (route handlers, Node)
                              │ 1. AuthN  : vérifie le JWT Supabase (cookie)
                              │ 2. AuthZ  : src/lib/authz.ts (miroir des policies)
                              │ 3. Data   : client Supabase lié au JWT de l'appelant
                              ▼
                           Supabase (Postgres + RLS EN FILET)
```

**Point clé — défense en profondeur pendant la transition.** L'API interroge
Supabase **sous l'identité de l'appelant** (client `@supabase/ssr` lié aux
cookies), donc **RLS reste actif en filet**. On ajoute **par-dessus** notre AuthZ
applicative complète. Pendant la Phase 0 : *ceinture (AuthZ) + bretelles (RLS)*.
Au moment Railway : RLS disparaît, l'AuthZ applicative devient l'unique gardien —
déjà écrite et éprouvée.

## 4. Le problème dur : AuthZ **indépendante de RLS** vs « pas de service_role »

Pour qu'une AuthZ applicative soit **complète** (survive à la disparition de RLS),
ses prédicats (`isOwner`, `canReadTree`, `canWriteTree`, `isAdmin`, part public…)
doivent **lire** l'appartenance/propriété (`trees.owner_id`, `tree_members`,
`profiles.role`) **sans être eux-mêmes filtrés par RLS**. Or lire hors-RLS exige
un accès privilégié — précisément ce que le projet **refuse** dans le runtime
(`aucun service_role`, cf. CLAUDE.md).

**Conséquence honnête :** en Phase 0 (DB = Supabase), l'API ne peut PAS faire de
lectures d'autorisation privilégiées sans introduire un secret privilégié
serveur. Deux options (décision §12) :

- **A — Prédicats délégués à RLS (transitoire, 0 secret).** Les prédicats lisent
  via le client de l'appelant : `select id from trees where id=?` renvoie une
  ligne **ssi** l'appelant est owner (RLS `trees_select`), etc. C'est
  **circulaire** (on utilise RLS pour vérifier une AuthZ qui mire RLS) → tant que
  RLS est là, c'est correct et sûr, mais **l'AuthZ n'est pas encore autonome**.
  L'autonomie s'obtient **gratuitement au moment Railway** (l'API possède alors la
  connexion DB privilégiée → les prédicats lisent en direct). **Recommandé.**
- **B — Credential serveur privilégié dès la Phase 0.** Introduire une clé
  `service_role` **uniquement côté serveur API** (jamais au client). L'AuthZ
  devient tout de suite autonome, mais on rompt le principe « aucun service_role »
  et on élargit le rayon d'explosion (une faille SSRF/route = bypass RLS total).

**Design retenu :** interface `AuthzDataProvider` (lit owner/membership/role)
**injectable**. Phase 0 → implémentation « client de l'appelant » (option A).
Railway → implémentation « connexion DB privilégiée ». **La LOGIQUE des prédicats
ne change jamais** : c'est l'actif durable.

## 5. Inventaire des endpoints (miroir des accès actuels)

Regroupés par ressource ; chaque endpoint = AuthN + AuthZ + forward.

| Endpoint | Méthodes | Remplace | AuthZ (policy mirrorée) |
|---|---|---|---|
| `/api/data/trees` | GET, POST | load/save trees | owner (trees_*) |
| `/api/data/trees/[id]` | GET, PATCH, DELETE | one tree | owner ; DELETE = owner |
| `/api/data/trees/[id]/persons` | GET, PUT(bulk upsert) | pushChildTable persons | canWriteTree |
| `/api/data/trees/[id]/persons/delete` | POST (soft-delete) | deleteChildRows | canWriteTree |
| `/api/data/trees/[id]/relationships` | GET, PUT, delete | idem relations | canWriteTree |
| `/api/data/trees/[id]/journal` | GET, PUT, delete | idem journal | canWriteTree |
| `/api/data/trees/[id]/conflicts` | POST | detectDeleteConflicts + preserveRemoteExtra | canWriteTree |
| `/api/data/public/[slug]` | GET | loadPublicTree | part public (masque privés + jamais le journal) |
| `/api/data/profile` | GET, PATCH | useAuth profil | self (profiles_*) |
| `/api/data/profiles/public` | POST(ids) | get_public_profiles | forward RPC |
| `/api/data/sharing/*` | … | sharing.ts (6 RPC) | forward RPC (SECURITY DEFINER porte déjà l'AuthZ) |
| `/api/data/admin/*` | … | useAdminData (9 RPC) | isAdmin + forward RPC |
| `/api/data/push-tokens` | POST | déjà une route (`/api/push/register`) | self |

Les **RPC** (`sharing/*`, `admin/*`, `consume_rate_limit`, `get_public_profiles`)
sont **forwardées** telles quelles en Phase 0 (elles encapsulent déjà leur AuthZ).
Seuls les **accès table directs** gagnent une AuthZ applicative neuve.

## 6. Bascule du transport (le cœur, sans casser la sync)

`supabaseSync.ts` expose déjà une frontière propre. Stratégie : **réimplémenter
ses primitives derrière un `DataClient`** au lieu de réécrire le store.

```ts
// src/lib/dataClient.ts (nouveau) — une seule frontière réseau.
interface DataClient {
  loadTrees(): Promise<LoadResult>;
  saveTree(tree, isOwner): Promise<void>;
  pushChildren(treeId, table, rows): Promise<void>;
  softDelete(treeId, table, ids): Promise<boolean>;
  detectConflicts(...); preserveRemoteExtra(...); loadPublicTree(slug);
}
// Deux implémentations :
//   • SupabaseDataClient  (actuel : appelle supabase.from directement)  ← rollback
//   • ApiDataClient       (nouveau : fetch('/api/data/...'))            ← cible
```

- Le **store** (`useFamilyStore`), le **merge**, le **soft-delete**, les
  **conflits**, `preserveRemoteExtra`, les tests pure-logic **ne changent pas** :
  ils appellent le `DataClient`, pas Supabase.
- Le **local-first** est intact : écriture optimiste locale → push débouncé via
  `ApiDataClient`.
- **Realtime** reste direct (Phase 0) → aucun changement de collaboration.

## 7. Rollback (100 %)

Feature flag **`NEXT_PUBLIC_DATA_LAYER = 'api' | 'direct'`** (défaut `direct`).
`getDataClient()` renvoie `ApiDataClient` ou `SupabaseDataClient`. Rollback =
repasser la variable à `direct` + redeploy (les deux chemins coexistent tout au
long de la phase). On peut **canary** endpoint par endpoint (le flag peut être
plus fin : `DATA_LAYER=api:trees,persons`).

## 8. Mobile (hors Phase 0, mais à cadrer)

L'app native tape Supabase en direct et **ne peut pas être forcée à jour**. Donc :
mobile **reste direct** pendant la Phase 0 (Supabase + RLS toujours là → OK). La
bascule mobile → API est un **track parallèle** à finir **avant** le cutover DB
Railway (sinon les vieux builds cassent quand la DB bouge). Implique : versionner
l'API, période de double-support, et pousser une MAJ mobile obligatoire avant
cutover. **À planifier tôt** (c'est le vrai chemin critique du zéro-downtime).

## 9. Ce qui bouge, et quand

| Brique | Phase 0 | Plus tard |
|---|---|---|
| Accès table (web) | ✅ via API | — |
| AuthZ applicative | ✅ (option A) | autonome au cutover Railway |
| RPC | forward | logique réécrite en API (Railway) |
| Realtime | direct | → Pusher **avec** la DB |
| Storage | direct | → R2 |
| Auth | Supabase | → Clerk |
| Mobile | direct | track parallèle avant cutover |

## 10. Tests

- **AuthZ unitaire** (`e2e/authz.spec.ts`, pure-logic) : table de vérité
  owner/membre/public/admin × read/write × ressource → allow/deny, en miroir des
  29 policies. **Le plus important** (une erreur = fuite inter-locataire).
- **Sync inchangée** : `sync-logic`, `realtime-echo`, `conflict-resolution`…
  tournent tels quels contre `SupabaseDataClient` **et** un faux `ApiDataClient`.
- **Contrat API** : chaque route testée AuthN(401)/AuthZ(403)/happy-path, avec un
  faux client Supabase (façon `supabase-sync.spec`).
- **Parité** : un test compare `SupabaseDataClient` vs `ApiDataClient` sur les
  mêmes opérations (mêmes résultats) → garantit la bascule sans régression.

## 11. Risques

1. **Faille d'AuthZ = fuite inter-locataire** (risque n°1). Mitigations : RLS en
   filet pendant toute la Phase 0, tests AuthZ exhaustifs, revue dédiée, canary.
2. **Latence** : +1 hop (navigateur→Vercel→Supabase). Acceptable pour un push
   débouncé ; à surveiller sur le load initial.
3. **Offline/invité** : inchangé (localStorage, aucun appel API). Vérifier que le
   flag `direct`/absence de session garde le mode invité.
4. **Dérive mobile** (§8) : le vrai chemin critique.
5. **Surface** : 49 sites + 16 RPC → **plusieurs PR** (voir §13), jamais un big-bang.

## 12. Décisions à valider (avant tout code)

1. **AuthZ Phase 0 : option A (déléguée à RLS, 0 secret, autonome au cutover) —
   recommandée — ou B (service_role serveur dès maintenant) ?**
2. **Périmètre Phase 0 : web only** (mobile track parallèle) — confirmé ?
3. **Forwarder les 16 RPC** en Phase 0 (vs les réécrire tout de suite) — OK ?
4. **Nom/forme du flag de rollback** (`NEXT_PUBLIC_DATA_LAYER`) et granularité
   (global vs par-ressource) ?
5. **Cette phase pèse plusieurs PR** : valides-tu le découpage §13 (je livre PR par
   PR, `tsc`/`build`/tests verts à chaque, feature-flag `direct` par défaut → rien
   n'est visible tant qu'on ne bascule pas) ?

## 13. Découpage en PR (proposé)

1. **Socle** : `DataClient` (interface) + `SupabaseDataClient` (= comportement
   actuel, extrait de `supabaseSync`) + `getDataClient()` + flag. **Aucun endpoint,
   aucun changement de comportement** (juste l'indirection). Filet de sécurité.
2. **AuthN/AuthZ** : `src/lib/authz.ts` + `AuthzDataProvider` (option A) + tests
   AuthZ exhaustifs. Toujours aucun endpoint monté.
3. **Endpoints lecture** : `/api/data/trees`, `/persons`, `/relationships`,
   `/journal`, `/public/[slug]`, `/profile` + `ApiDataClient.load*`. Canary lecture.
4. **Endpoints écriture** : upsert/soft-delete/conflicts/preserveRemoteExtra +
   `ApiDataClient.save/push/delete`. Canary écriture.
5. **RPC forward** : `/api/data/sharing/*`, `/admin/*`, profils publics, rate-limit.
6. **Bascule** : `DATA_LAYER=api` en prod, observation, puis retrait progressif du
   chemin `direct` (web). Mobile démarre son track.

---

### Résumé exécutif

Phase 0 = **un seul point d'accès données** (API) + **une AuthZ applicative**
prête à remplacer RLS, **sans rien changer pour l'utilisateur** et **rollbackable
par un flag**. Le sync local-first est préservé (seul le transport change). La
seule vraie limite technique est que l'AuthZ ne devient **pleinement autonome**
(indépendante de RLS) qu'au moment où on possède la connexion DB privilégiée
(cutover Railway) — sauf à introduire un `service_role` serveur dès maintenant
(option B). **Le mobile est le chemin critique** à cadrer tôt.
