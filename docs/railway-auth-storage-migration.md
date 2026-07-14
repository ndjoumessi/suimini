# Migration Auth + Storage hors Supabase — plan & prérequis (Phase 2)

> État : **PLANIFICATION + ÉCHAFAUDAGE SÛR (2026-07-14).** Aucune bascule, aucune
> écriture prod, aucun cutover. Le user a dit « commencer maintenant » (risque
> assumé) ; ce document + le seam `StorageProvider` sont le maximum de progrès
> RÉEL réalisable **sans credentials de production** et **sans risquer le login de
> qui que ce soit**. Il reproduit exactement la méthode de la migration DONNÉES
> (`docs/railway-migration.md`) : **abstraction additive + flag + rollback une-ligne
> + validation en shadow avant tout cutover**, l'exécution créditée revenant au user.
>
> ⚠️ **Supabase reste une dépendance ACTIVE et CRITIQUE.** Tant que ce chantier
> n'est pas terminé ET soaké, fermer/supprimer le compte Supabase casse le login de
> **tous** les users + l'affichage des photos. Ne JAMAIS le couper (cf. §8 de
> `docs/railway-migration.md`).

## 0. TL;DR — recommandation professionnelle

- **Phase A (Storage) : commençable prudemment MAINTENANT.** Risque faible (échec =
  « la photo ne s'affiche pas », jamais « personne ne peut se connecter »). Le seam
  `StorageProvider` est **déjà posé** (ce commit), sans changement de comportement.
- **Phase B (Auth) : NE PAS commencer la bascule maintenant.** C'est la primitive de
  session : une erreur = tout le monde dehors. **3 jours** de soak data (cutover du
  2026-07-11) sont **trop courts** pour empiler par-dessus une migration d'auth. On
  **prépare** (inventaire, shadow-write des `profiles`, décision de provider) sans
  jamais cutover, et on attend plusieurs **semaines** de stabilité data d'abord.
  Ce n'est pas un refus : c'est l'ordre sûr. On livre le plan complet + le premier
  seam exécutable, on ne joue pas à pile-ou-face avec l'authentification en prod.

## 1. Objectif & périmètre

Retirer les **deux dernières dépendances Supabase** que la migration data avait
laissées **par conception** :
- **Storage** — bucket `avatars` (photos de profil + galerie).
- **Auth** — GoTrue / Supabase Auth : sessions, login (password + magic-link +
  reset), `profiles` (identité/rôle/statut/tenant/locale), RPC admin, RPC
  `get_public_profiles` / `get_tree_owner_push_targets`, `push_tokens`.

**Non-objectifs.** Rien du plan DONNÉES (déjà sur Railway). On ne reconstruit pas
la logique métier ; on remplace le **fournisseur** d'identité et de blobs.

## 2. Inventaire EXACT des points de contact (code réel Suimini)

### 2.1 Storage (bucket `avatars`) — périmètre Phase A

| Emplacement | Rôle | Migré via |
|---|---|---|
| `src/lib/uploadImage.ts` (`uploadAvatar`, `deleteAvatarByUrl`) | upload + suppression avatar web | **seam `StorageProvider` posé (ce commit)** |
| `src/lib/storageProvider.ts` **(NOUVEAU)** | frontière web : interface + `SupabaseStorageProvider` passe-plat | point d'insertion R2/MinIO |
| `mobile/lib/uploadImage.ts` (`uploadAvatarMobile`) | upload avatar mobile (ArrayBuffer) | **seam posé (ce commit)** |
| `mobile/lib/storageProvider.ts` **(NOUVEAU)** | frontière mobile (miroir) | idem |
| Appelants web (inchangés, signatures rétro-compatibles) | `PersonForm`, `PersonPanel`, `GalleryView`, `PhotoAnalyzer`, `DocumentScanner`, `OnboardingWizard` | — |
| `supabase/storage.sql` | bucket public `avatars` + 4 policies RLS (write scopé au 1er segment de path = `auth.uid()`, read public) | à re-porter côté nouveau store |
| Convention de path | `{userId}/{personId}-{ts}.{ext}` — **userId en 1er segment** (RLS) | invariant à préserver |

Note : le fallback data-URL (mode invité/démo, ou échec upload → image inline
base64) est **hors périmètre** — il ne touche aucun backend.

### 2.2 Auth / identité — périmètre Phase B

| Emplacement | Ce qu'il fait avec Supabase Auth / `profiles` |
|---|---|
| `src/hooks/useAuth.ts` | `getSession`, `onAuthStateChange` (**synchrone**, piège deadlock), `signUp`, `signInWithPassword`, `signInWithOtp` (magic-link), `resetPasswordForEmail`, `signOut` ; `fetchProfile` (`from('profiles').select('*')`) |
| `mobile/hooks/useAuth.ts` | miroir mobile (`onAuthStateChange` synchrone, session MMKV) |
| `src/proxy.ts` | garde de nav Next 16 : `getUser()` + `from('profiles').select('status')` → autorise `/app` seulement si `approved` (fail-closed sauf 42703) |
| `src/lib/apiAuth.ts` (`getServerAuth`) | résout l'appelant des routes `/api/data/*` par **cookie de session** OU **`Authorization: Bearer`** (mobile) ; lit `profiles.role` ; **le client Supabase de l'appelant est passé aux routes** (RLS = filet en mode supabase) |
| `src/app/auth/callback/route.ts`, `src/app/auth/reset-password/page.tsx` | flux OAuth/magic-link/reset (échange de code, update password) |
| `src/app/api/data/rpc/[name]/route.ts`, `src/lib/rateLimit.ts` (`consume_rate_limit`), routes email `send-approval*` | tournent sous l'identité de l'appelant ; `rateLimit` = RPC SECURITY DEFINER |
| `get_public_profiles(ids)` | lecture email/`display_name` d'un pair (RLS bloque le `select` direct) — utilisée par les emails owner-notify |
| **Push (commit `88bb351`, cette session)** | `src/app/api/push/register/route.ts` (enregistre un Expo token, auth Bearer) ; `src/app/api/push/notify-join/route.ts` ; RPC SECURITY DEFINER **`get_tree_owner_push_targets(text)`** (migration `0019`, renvoie tokens + `profiles.locale` du propriétaire, scopée owner/membre) ; table `push_tokens` (RLS `user_id = auth.uid()`) ; Edge Function `send-birthday-notifications` (lit `push_tokens` + `profiles.locale`) |
| `profiles` (colonnes) | `id`, `status`, `role`, `tenant_id`, `display_name`, `locale`, `organization` — **PAS** de `first_name`/`last_name` |
| RPC admin (`useAdminData`) | approbation/rejet/suspension de comptes (SECURITY DEFINER sur `profiles`) |

**Dépendance croisée majeure Auth ↔ Data (déjà sur Railway) :** les tables Railway
(`trees.owner_id`, `tree_members.user_id`, `person_comments.author_id`…) référencent
des **UUID `auth.users`** (le schéma Railway a délibérément mis des `uuid` nus, FK
Supabase strippée — cf. `railway/schema.sql`). **Migrer l'auth NE DOIT PAS changer
les identifiants d'utilisateur** (`user.id`), sinon toutes les données Railway
pointeraient dans le vide. C'est le **contrainte n°1** de la Phase B : **préserver
les UUID** (voir §5.2).

## 3. Architecture cible (miroir du pattern data)

Rappel du pattern qui a marché pour les données (`docs/railway-migration.md` §2) :
frontière (`getDataStore`) + deux impls (`SupabaseStore` = rollback, `RailwayStore`
= neuf) + flag serveur (`DB_BACKEND`) + allowlist + rollback une-ligne. On le
reproduit **deux fois**, indépendamment :

- **Storage** → `StorageProvider` (`getStorageProvider()`), impls
  `SupabaseStorageProvider` (défaut/rollback, **posé**) et, à venir,
  `ObjectStoreProvider` (R2/MinIO). ⚠️ voir §4 : le point de sélection est **côté
  client**, PAS un env serveur runtime.
- **Auth** → à concevoir (§5). Beaucoup plus lourd : ce n'est pas un « store » qu'on
  swappe sous une route, c'est **toute la couche `@supabase/ssr` / GoTrue** (client
  browser + `proxy.ts` + `getServerAuth` + callbacks OAuth).

## 4. Phase A — STORAGE (risque faible, commençable)

### 4.1 Réalité technique : Railway n'héberge PAS de blob store natif

Railway n'a **pas** d'équivalent S3 managé. Un vrai stockage objet impose un service
tiers **S3-compatible** :
- **Cloudflare R2** (recommandé — pas d'egress, API S3, URLs signées, bucket public
  possible) ;
- **MinIO auto-hébergé sur Railway** (conteneur, S3-compatible, à opérer soi-même —
  sauvegardes/DR à sa charge) ;
- Backblaze B2 / AWS S3 (alternatives).

**Décision par défaut proposée : Cloudflare R2** (le plus proche du modèle actuel
« bucket public + URL publique », coût quasi nul à cette échelle).

### 4.2 Le seam est POSÉ (ce commit, zéro changement de comportement)

`src/lib/storageProvider.ts` + `mobile/lib/storageProvider.ts` : interface
`StorageProvider` (`upload` / `getPublicUrl` / `remove` / `pathFromPublicUrl`) +
`SupabaseStorageProvider` (passe-plat FIDÈLE). `uploadImage.ts` (web + mobile) passe
désormais par `getStorageProvider()`. **Aujourd'hui il n'existe qu'une implémentation
active, le passe-plat Supabase** → comportement byte-identique (validé par `tsc` +
le fait que les appels Supabase sont recopiés à l'identique).

### 4.3 ⚠️ Différence structurelle vs data (à trancher)

L'upload avatar part du **navigateur DIRECTEMENT** vers Supabase Storage (il ne
transite PAS par `/api/data/*`). Deux conséquences :
1. **Pas de flag serveur runtime** façon `DB_BACKEND` : le choix du backend est
   côté client → le flip se fera par `NEXT_PUBLIC_STORAGE_BACKEND` (build-time,
   redeploy) OU en routant l'upload par une **nouvelle route serveur** qui émet une
   **URL d'upload signée** R2 (pattern recommandé : le secret R2 ne fuite jamais au
   client). Le pattern « URL signée émise par une route » redonne un point de
   bascule serveur propre — **c'est l'option retenue par défaut**.
2. La **lecture** des photos existantes reste par URL publique : les anciennes URLs
   Supabase doivent continuer de résoudre pendant/après la bascule (voir rollback
   §4.6). On ne réécrit PAS les `profile_photo` déjà stockés dans les persons Railway.

### 4.4 Plan d'exécution Phase A (ordonné)

1. **Compte R2 + bucket** (`suimini-avatars`), accès public en lecture (ou domaine
   public R2). — *user only (credentials).* ✅ **FAIT** (bucket créé, clé S3 générée,
   secrets posés dans Vercel par le user).
2. **Route serveur `POST /api/storage/sign-upload`** : sous l'identité de l'appelant
   (`getServerAuth`), vérifie et **impose** le préfixe `{userId}/…` (miroir exact de
   la policy `avatar_upload`), renvoie une URL d'upload signée R2. → remplace la
   policy RLS write par une **AuthZ applicative** (comme `authz.ts` l'a fait pour la
   RLS data). ✅ **FAIT (code écrit)** — `src/app/api/storage/sign-upload/route.ts`
   (+ helper server-only `src/lib/r2.ts`, + `src/app/api/storage/delete/route.ts`
   pour la suppression signée). URLs présignées PUT, TTL **5 min**, secrets R2
   jamais renvoyés au client. Dépendances ajoutées : `@aws-sdk/client-s3` +
   `@aws-sdk/s3-request-presigner`.
3. **`ObjectStoreProvider`** (web + mobile) : `upload` via l'URL signée, `getPublicUrl`
   via le domaine public R2, `remove` via une route serveur signée. Se branche dans
   `getStorageProvider()` derrière `NEXT_PUBLIC_STORAGE_BACKEND=r2`. ✅ **FAIT (code
   écrit)** — ajouté dans `src/lib/storageProvider.ts` **et**
   `mobile/lib/storageProvider.ts` ; wiring via `NEXT_PUBLIC_STORAGE_BACKEND` (web) /
   `EXPO_PUBLIC_STORAGE_BACKEND` (mobile). **INERTE par défaut** : sans le flag, le
   passe-plat Supabase reste actif à l'identique (zéro changement de comportement).
   Le mobile authentifie la signature via `Authorization: Bearer` (miroir de
   `supabaseSync.ts`).

   **Variables d'environnement à poser dans Vercel** (le user — jamais l'agent) :
   | Env | Portée | Contenu |
   |---|---|---|
   | `R2_ACCOUNT_ID` | serveur (secret*) | ID de compte Cloudflare (préfixe de l'endpoint `<id>.r2.cloudflarestorage.com`) |
   | `R2_ACCESS_KEY_ID` | serveur **secret** | Access Key ID de la clé S3 R2 |
   | `R2_SECRET_ACCESS_KEY` | serveur **secret** | Secret Access Key de la clé S3 R2 |
   | `R2_BUCKET_NAME` | serveur | Nom du bucket (défaut `suimini-avatars`) |
   | `R2_PUBLIC_BASE_URL` | serveur | Domaine de lecture publique R2, ex. `https://cdn.suimini.app` (utilisé pour renvoyer `publicUrl` depuis sign-upload) |
   | `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` | client (build) | **même** domaine public que ci-dessus (le web construit l'URL d'image côté client — domaine public, pas un secret) |
   | `NEXT_PUBLIC_STORAGE_BACKEND` | client (build) | **flag de flip** : `r2` active R2 ; absent/`supabase` = rollback |
   | `EXPO_PUBLIC_R2_PUBLIC_BASE_URL` | mobile (build) | domaine public R2 (miroir mobile) |
   | `EXPO_PUBLIC_STORAGE_BACKEND` | mobile (build) | flag de flip mobile (`r2`) |

   *`R2_ACCOUNT_ID` n'est pas un secret cryptographique mais reste server-only par
   propreté. **NE PAS** poser `NEXT_PUBLIC_STORAGE_BACKEND=r2` tant que la checklist
   §4.5 n'est pas verte (étapes 4-6 = user).

   ⚠️ **Trou du plan initial, découvert à la validation (2026-07-14) : CORS bucket
   requis.** Un upload PUT direct navigateur→R2 via URL présignée est une requête
   **cross-origin** (`suimini.vercel.app` → `*.r2.cloudflarestorage.com`) → sans
   policy CORS sur le bucket, le preflight `OPTIONS` échoue et le PUT ne part jamais
   (`ERR_FAILED`, pas d'`Access-Control-Allow-Origin`). **Configuré manuellement par
   le user** dans R2 → `suimini-avatars` → Settings → CORS Policy :
   ```json
   [{ "AllowedOrigins": ["https://suimini.vercel.app", "http://localhost:3000"],
      "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600 }]
   ```
   N'affecte QUE le web (upload navigateur) — le mobile (fetch natif, pas de CORS)
   n'en a pas besoin. ⚠️ Si un jour un domaine personnalisé ou un déploiement Preview
   doit aussi uploader vers R2, il faudra l'ajouter à `AllowedOrigins`.

   ✅ **VALIDÉ EN PROD (2026-07-14)**, cycle complet réel : `sign-upload` authentifié
   → **200** avec URL présignée ; PUT direct navigateur→R2 → **200** ; lecture via
   `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` (domaine `pub-*.r2.dev`, Public Development URL) →
   **200**, contenu correct. Confirme : credentials R2 valides, AuthZ préfixe userId
   opérationnelle, `ObjectStoreProvider` web fonctionnel de bout en bout. **Objet de
   test (`{userId}/test.webp`) à purger du bucket avant d'aller plus loin** (pas un
   avatar réel). Reste à valider avant flip (voir §4.5) : test négatif (path hors
   préfixe → 403), chemin mobile, et la copie des blobs existants.
4. **Dual-write optionnel (shadow)** : pendant N jours, uploader vers R2 **et**
   Supabase (ou juste R2 en écrivant l'URL R2, Supabase restant lisible pour
   l'existant). Valider que les nouvelles photos s'affichent partout (web + mobile +
   PDF + partage public).
5. **Copie des blobs existants** Supabase → R2 (script `rclone`/S3 sync). — *user
   (credentials Supabase Storage + R2).* Réécriture des URLs `profile_photo` = **pas
   nécessaire** si on garde le domaine Supabase lisible ; sinon rewrite par script.
6. **Flip** `NEXT_PUBLIC_STORAGE_BACKEND=r2` + redeploy.

### 4.5 « Definition of ready » — Storage (avant flip)

- [x] Bucket R2 créé, lecture publique vérifiée sur une URL de test. **(2026-07-14,
      cycle complet réel : sign-upload 200 → PUT navigateur 200 → lecture publique
      200, contenu correct — voir §4.4.)**
- [x] Route `sign-upload` : refuse un path hors `{caller.userId}/…` (test négatif).
      **(2026-07-14, testé en prod : path `quelquun-dautre/x.webp` → 403 `{error:
      "Chemin interdit : le premier segment doit être votre identifiant."}`.)**
- [ ] Upload web **et** mobile via R2 → l'image s'affiche (fiche, galerie, arbre,
      PDF, `/arbre/[slug]` public) — web validé en brut (PUT + lecture), pas encore
      via un vrai composant d'upload (`AddPersonModal`/`PhotoAnalyzer`/…) ; mobile pas
      testé.
- [x] Compte des objets Supabase == compte des objets R2 après copie (réconciliation,
      façon 71/122 de la data). **(2026-07-15, via `scripts/copy-avatars-to-r2.sh
      DRY_RUN=0` : 11 objets Supabase → 11 transférés → 11 côté R2, comptes égaux.
      Tous dans `a8d07d13-f795-41ec-824f-5453cce02c0e/` — photos TEDA.)**
- [x] Les **anciennes** URLs Supabase résolvent toujours (aucune photo cassée) —
      trivialement vrai : `rclone copy` (jamais `sync`), Supabase Storage jamais
      touché, seule une copie a été écrite côté R2.
- [ ] Rollback testé (voir §4.6) — trivial par construction (flag jamais posé), pas
      testé activement.

✅ **Objet de test purgé** `{userId}/test.webp` **(2026-07-14, via `DELETE
/api/storage/delete` → 200 `{ok:true}`).**

### 4.6 Rollback Storage (barre « une ligne »)

`NEXT_PUBLIC_STORAGE_BACKEND` absent/`supabase` + redeploy → `getStorageProvider()`
rerend le passe-plat Supabase. **Supabase Storage n'est jamais vidé** tant que la
Phase A n'est pas soakée → toute photo y reste lisible. (Moins « instantané » que le
rollback Edge Config data, car côté client = redeploy ; c'est la limite structurelle
§4.3, pas un défaut d'implémentation.)

## 5. Phase B — AUTH (risque MAXIMAL — préparer, NE PAS cutover maintenant)

### 5.1 Choix de provider — arbitrage spécifique à Suimini

Besoins réels de l'app (relevés au §2.2) : **password + magic-link + reset**,
**JWT Bearer pour le mobile** (`getServerAuth`), **rôles/statuts** (`user|admin|
superadmin`, `pending|approved|rejected|suspended`) portés par `profiles`, RPC admin,
et surtout **préservation des UUID `auth.users`** (les données Railway y sont
liées).

| Option | Pour | Contre (Suimini) |
|---|---|---|
| **GoTrue self-hébergé** (le même moteur, sur Railway) | **Continuité maximale** : mêmes JWT, `@supabase/ssr` marche presque tel quel, magic-link/reset natifs, **UUID préservables** (dump `auth.users`) | il faut opérer GoTrue + SMTP + rotation des secrets JWT ; on quitte Supabase mais pas GoTrue |
| **Better Auth / Lucia** (TS, self-host) | contrôle total, pas de lock-in, colle à Next | **réécriture COMPLÈTE** de `useAuth`/`proxy`/`getServerAuth` ; refonte du modèle de session/JWT ; risque élevé |
| **Clerk / WorkOS / Auth0** (managé) | zéro ops, MFA, UI prêtes | on **re-crée** un lock-in ; migration des comptes + **remap d'UUID** (⚠️ casse les FK Railway sauf import d'UUID custom) ; coût |

**Recommandation par défaut : GoTrue self-hébergé sur Railway.** C'est le seul chemin
qui **préserve les UUID** et réutilise `@supabase/ssr` → il transforme la Phase B en
« changer l'URL/les clés GoTrue » plutôt qu'en réécriture de toute la couche auth.
À rediscuter explicitement avant de coder quoi que ce soit.

### 5.2 Contrainte n°1 — préserver les UUID utilisateur

Les données Railway référencent `auth.users(id)` en UUID nu. **Toute** solution
Phase B doit réimporter les **mêmes** `id`. GoTrue self-host : `pg_dump` du schéma
`auth` → restore. Provider managé : n'est acceptable que s'il autorise l'import
d'UUID **externes** (Clerk `external_id` ≠ id primaire → il faudrait remapper toutes
les FK Railway, chantier à part entière). **C'est le point qui exclut de facto les
providers qui imposent leurs propres IDs.**

### 5.3 Sous-phases Auth (aucune n'est un cutover)

1. **Shadow-mirror des `profiles`** vers Railway (table `profiles` copiée, lecture
   seule, **jamais** faisant autorité) — réconciliation de comptes, à la façon du
   dump data. Purement additif.
2. **Décision de provider** (§5.1) tranchée + feu vert explicite.
3. **Stand-up GoTrue** (ou provider) en **parallèle**, non branché à la prod :
   valider login/magic-link/reset/Bearer sur un env de test.
4. **`getServerAuth` bi-source** (comme `DataStore` a deux backends) : accepter un
   JWT émis par l'ancien **ou** le nouveau provider pendant la transition.
5. **Cutover** (dernier, sous garde-fou) : basculer l'émission de session ; fenêtre
   de double-validation de JWT ; rollback = repointer sur GoTrue Supabase.

### 5.4 « Definition of ready » — Auth (avant tout cutover, indicatif)

- [ ] **Plusieurs semaines** de data-plane Railway stable (le soak de 3 jours actuel
      est insuffisant pour empiler l'auth).
- [ ] `profiles` shadow réconciliée (compte source == destination).
- [ ] UUID **identiques** vérifiés (un échantillon `owner_id`/`user_id` Railway
      résout vers le même compte des deux côtés).
- [ ] Login password + magic-link + reset + **Bearer mobile** validés sur env test.
- [ ] `proxy.ts` (garde `/app`) + `getServerAuth` + RPC admin OK sur le nouveau
      provider.
- [ ] Push : `push_tokens` + `get_tree_owner_push_targets` + Edge Function
      re-câblés (ou migrés) sur le nouveau backend d'identité.
- [ ] Rollback auth répété avec succès sur env test.

### 5.5 Rollback Auth

Tant qu'on reste sur **GoTrue self-host**, le rollback = repointer les clés/URL
GoTrue vers Supabase + redeploy, **si** aucun nouveau compte n'a été créé uniquement
côté nouveau GoTrue depuis le cutover (sinon divergence). C'est **plus fragile** que
data/storage (l'auth est stateful : sessions vivantes, comptes créés en vol). D'où :
cutover auth seulement après un soak long et une fenêtre de double-validation JWT.

## 6. Ce qui N'EST PAS exécutable dans cette session (sans credentials)

L'agent n'a **ni** service_role / mot de passe DB Supabase, **ni** credentials
Railway/R2/GoTrue de prod. Donc **impossible** depuis l'agent :
- créer un compte/bucket R2 ou un service GoTrue ;
- lire/copier les blobs Supabase Storage, dumper `auth.users`/`profiles` ;
- appliquer un SQL en prod, flipper un env Vercel, cutover quoi que ce soit.

**Ce que le user seul peut faire (ordonné) pour démarrer la Phase A (Storage) :**
1. Créer un **bucket Cloudflare R2** `suimini-avatars` + un domaine/accès public en
   lecture ; générer une **paire de clés S3** (Access Key ID / Secret) — à fournir en
   secrets Vercel (jamais au client).
2. Décider : **URL signée via route serveur** (recommandé) vs `NEXT_PUBLIC` direct.
3. Fournir les credentials → l'agent code `ObjectStoreProvider` + `sign-upload`
   (sans jamais les credentials en dur).
4. Lancer la **copie des blobs** Supabase Storage → R2 (`rclone`/S3 sync) + fournir
   les **comptes source** pour réconciliation.
5. Poser `NEXT_PUBLIC_STORAGE_BACKEND=r2` (ou l'équivalent route-signée) + redeploy,
   après la checklist §4.5.

Pour la **Phase B (Auth)** : ne rien provisionner tant que le soak data n'a pas duré
plusieurs semaines ET que le provider n'a pas été tranché (§5.1).

## 7. Résumé de l'état

| | Data (Phase 1) | Storage (Phase A) | Auth (Phase B) |
|---|---|---|---|
| Frontière/seam | `DataStore` ✅ | `StorageProvider` ✅ | à concevoir |
| Impl neuve | `RailwayStore` ✅ live 100% | `ObjectStoreProvider` ✅ **code écrit, INERTE** (routes `sign-upload`/`delete` + `lib/r2.ts` + web/mobile) | ⏳ (préparation seulement) |
| Backend cible | Railway PG | Cloudflare R2 | GoTrue self-host (proposé) |
| Prêt à démarrer ? | fait | **code prêt — flip = user (poser les env R2 + `NEXT_PUBLIC_STORAGE_BACKEND=r2` après checklist §4.5)** | **non — attendre le soak** |
| Rollback | Edge Config une-ligne | flag client absent/`supabase` + redeploy | repointage GoTrue (fragile) |

> **Storage — état 2026-07-14** : le code Phase A est écrit et **inerte par défaut**
> (comme `RailwayStore`/`ObjectStoreProvider` l'étaient avant leur flip). Fichiers :
> `src/app/api/storage/sign-upload/route.ts`, `src/app/api/storage/delete/route.ts`,
> `src/lib/r2.ts`, `ObjectStoreProvider` dans `src/lib/storageProvider.ts` **et**
> `mobile/lib/storageProvider.ts`. Env à poser (liste faisant autorité) → §4.4 étape 3.
>
> **Bucket + credentials posés, cycle web validé en prod** (voir §4.4/§4.5) : compte
> R2 créé, bucket `suimini-avatars` (Western Europe, Standard), Public Development
> URL activée (`pub-*.r2.dev`), clé S3 dédiée (Object Read & Write, scopée au
> bucket), 6 env Vercel posées, redeploy fait, **CORS bucket configuré** (trou du
> plan initial, corrigé — voir §4.4). `sign-upload` → 200, PUT navigateur → 200,
> lecture publique → 200. Restant côté user : purger l'objet de test, copie des
> blobs existants (§4.4 étape 5) puis flip (étape 6, après checklist §4.5 complète —
> test négatif AuthZ, mobile, et upload via un vrai composant de l'app encore dus).
