# Audit de sécurité — Suimini

**Périmètre** : application web Next.js 16 + mobile Expo, backend hybride (Auth/profils sur Supabase, données d'arbre sur Railway Postgres brut sans RLS).
**Date** : 16 juillet 2026 · **Méthode** : revue de code en lecture seule, aucune exploitation réelle.
**Verdict global** : l'architecture de sécurité est solide et manifestement pensée (guards systématiques, SQL 100% paramétré, secrets jamais exposés, échappement HTML des emails). **Une régression de confidentialité réelle et active en production** a été identifiée (fuite du journal aux membres sur le backend Railway), plus quelques points de durcissement de sévérité moindre.

---

## Synthèse des findings

| # | Sévérité | Titre | Fichier | Statut |
|---|----------|-------|---------|--------|
| F1 | **Haute** | Le journal familial fuite aux membres acceptés via la lecture non masquée (backend Railway, sans RLS) | `railwayStore.ts:185-202`, `apiData.ts:44-51` | **✅ Corrigé (2026-07-16)** — `stripUnauthorizedJournal` (`authz.ts`) appliqué dans `GET /api/data/trees` et `GET /api/data/trees/[id]` juste avant la réponse JSON, testé (`e2e/authz.spec.ts`). |
| F2 | **Moyenne** | Le partage public lit un instantané Supabase figé → édition privée/suppression post-cutover non honorée | `supabaseSync.ts:479-509`, `supabaseSync.ts:466-472` | **✅ Corrigé (2026-07-16)**, effet de bord du correctif architecture F1 — `loadPublicTree`/`getPublicShare`/`setTreePublic` passent désormais par `DataStore` (Railway ou Supabase selon `DB_BACKEND`), plus jamais Supabase-direct. |
| F3 | **Moyenne** | Tokens de session Supabase stockés en clair (MMKV non chiffré) sur mobile | `mobile/lib/supabase.ts:11-33` | ✅ Corrigé (2026-07-16) — non testé sur device réel, voir note |
| F4 | Basse | Rate-limiting IA « fail-open » sur panne RPC/Supabase | `rateLimit.ts:90-102` | ✅ Corrigé (2026-07-16) |
| F5 | Basse | Envoi d'email d'invitation à une adresse arbitraire, sans rate-limit, nom d'expéditeur contrôlé | `send-invite-email/route.ts:19-70` | ✅ Corrigé (2026-07-16) |
| F6 | Basse | Fail-open pré-migration : `42703` = tout utilisateur traité comme admin/approuvé | `send-approval/route.ts:35`, `proxy.ts:45-46` | ✅ Vérifié (2026-07-16) — déjà scopé, pas de changement requis |
| F7 | Basse/Info | Pas de protection CSRF explicite (repose sur SameSite implicite des cookies Supabase) | routes `/api/*` | ✅ Corrigé (2026-07-16) |

---

## F1 — Haute — Fuite du journal aux membres acceptés (backend Railway)

**Fichiers** : `src/lib/railwayStore.ts:185-202` (`loadOneTree`) et `:146-183` (`loadTrees`) ; garde `src/lib/apiData.ts:44-51` (`guardTreeRead`) ; modèle attendu `src/lib/authz.ts:81-85` (`canReadJournal`).

Le modèle d'autorisation (documenté dans `authz.ts:13-20`, fidèle aux policies Supabase d'origine) distingue deux niveaux de lecture :
- **persons/relationships** : owner OU `tree_shares(read|write)` OU **membre accepté** OU public.
- **journal** : owner OU `tree_shares(read|write)` **uniquement** — ni membre, ni public.

La policy Supabase `journal_select` s'appuie sur `can_read_tree()` = owner OU tree_shares seulement (`schema.sql:118-121`), tandis que `sharing.sql:75-94` n'ajoute `is_accepted_member()` qu'aux policies trees/persons/relationships — jamais au journal.

**Le bug** : l'endpoint de lecture non masquée `GET /api/data/trees/[id]` est gardé par `guardTreeRead` → `canReadTreeAsMember` = owner OU share OU **membre accepté** (`authz.ts:69-73`). Une fois la garde passée, `RailwayStore.loadOneTree` renvoie l'arbre **journal compris, sans aucun filtrage par appelant** (`railwayStore.ts:189-201`). `canReadJournal` n'est jamais appelé sur ce chemin.

**Pourquoi c'est actif** : sur SupabaseStore (rollback), `loadOneTree` tourne sous le client RLS de l'appelant → la policy `journal_select` renvoie 0 ligne à un membre. Sur RailwayStore il n'y a **pas de RLS** — l'authz applicative est l'unique gardien, et elle ne strippe pas le journal. La prod est **LIVE GLOBAL 100% sur Railway**. **La fuite est donc active en production.**

**Scénario d'exploitation** : un propriétaire invite Bob comme membre **viewer** (niveau le moins privilégié). Bob accepte. Bob ouvre l'arbre → `GET /api/data/trees/[id]` → la réponse JSON contient toutes les entrées du journal familial, alors que le produit garantit que seuls le propriétaire et les partages email explicites y ont accès.

**Remédiation** : dans le chemin Railway, ne renvoyer le journal que si `canReadJournal(store.authz, treeId, caller)` est vrai (flag `includeJournal` calculé par la route, ou strip `tree.journal = []` quand faux). Ajouter un test e2e : « membre accepté (viewer) → journal vide, share=read → journal présent ».

---

## F2 — Moyenne — Le partage public lit un instantané Supabase désormais divergent

**Fichiers** : `src/lib/supabaseSync.ts:479-509` (`loadPublicTree`), `:466-472` (`setTreePublic`), `src/app/arbre/[slug]/page.tsx`.

`loadPublicTree` lit `trees`/`persons`/`relationships` **depuis Supabase** via un client anonyme, avec RLS + double filtrage des fiches privées (`:497-500`) — la logique elle-même est saine (journal jamais exposé, colonnes en allowlist).

Le problème est la **divergence de datastore** introduite par la migration Railway : les écritures de contenu vont sur Railway, mais `setTreePublic`/`loadPublicTree` parlent directement à Supabase, qui est une **copie figée au moment du cutover**.

**Conséquence** : si après le cutover un propriétaire passe une personne en `private` ou la supprime (édition sur Railway), le changement n'est pas propagé à Supabase — la page publique continue de montrer l'ancienne version, **exposée publiquement** alors que le propriétaire croit l'avoir masquée.

**Remédiation** : router `loadPublicTree`/`setTreePublic` vers le même backend que les écritures (route serveur dédiée `GET /api/data/public/[slug]` réutilisant les prédicats `isPersonPubliclyVisible`/`isRelationshipPubliclyVisible` déjà écrits dans `authz.ts:107-120`). À défaut, désactiver temporairement le partage public tant qu'il lit une copie figée.

---

## F3 — Moyenne — Session Supabase mobile stockée en clair (MMKV non chiffré)

**Fichier** : `mobile/lib/supabase.ts:11-33` + `mobile/lib/storage.ts:36-53`.

Le client Supabase mobile persiste la session (access token et **refresh token**) via MMKV sans `encryptionKey`. MMKV n'est pas chiffré par défaut : les tokens sont écrits en clair sur le disque de l'appareil.

**Scénario** : sur un appareil rooté/jailbreaké ou via un backup non chiffré, le refresh token (longue durée) peut être extrait puis rejoué pour obtenir des sessions valides → prise de contrôle du compte.

**Correctif (2026-07-16)** : `mobile/lib/storage.ts` génère (ou relit) une clé de 16 caractères via `expo-secure-store` (API synchrone JSI, plugin déjà posé dans `app.json`), persistée dans le Keychain (iOS) / Keystore (Android) — c'est cette couche, pas l'entropie de la clé, qui protège contre l'extraction (Keychain exclu des sauvegardes non chiffrées, protection matérielle quand disponible). L'instance MMKV `suimini-auth` est construite SANS `encryptionKey` (pour lire une session déjà écrite en clair par une version antérieure) puis `recrypt(key)` (synchrone) migre en place — aucune session existante perdue, aucune déconnexion forcée à la mise à jour. Scopé au SEUL store de session (`createKVStorage('suimini-auth', 'suimini_mmkv_auth_key')`) ; les 4 autres instances MMKV (thème, i18n, tokens push, cache arbre) restent inchangées, ne portant pas de secret équivalent. Repli gracieux (pas de chiffrement, comme avant) si `SecureStore` est indisponible.

⚠️ **Non vérifié sur device/simulateur réel** : cet agent n'a pas d'accès à un appareil ou simulateur mobile dans son environnement d'exécution. Vérifié uniquement via `tsc --noEmit` (propre) et `expo export --platform android` (le bundling Metro JS résout les 3471 modules sans erreur — la seule étape qui échoue ensuite, la compilation Hermes en bytecode natif, échoue pour une raison d'environnement sans rapport : le binaire `hermesc` fourni est x86-64 et ce sandbox tourne en ARM64). **Avant tout déploiement, tester manuellement sur un dev build réel** : login, kill+relaunch de l'app (la session doit survivre), et si possible vérifier qu'une session pré-existante (utilisateur déjà connecté avant ce correctif) n'est pas invalidée par la première migration `recrypt`.

---

## F4 — Basse — Rate-limiting IA « fail-open » sur panne — ✅ Corrigé (2026-07-16)

**Fichier** : `src/lib/rateLimit.ts:90-102`.

Les 5 routes IA sont toutes protégées (`enforceRateLimit` vérifié en tête de chaque handler). Mais si la RPC `consume_rate_limit` échouait (migration absente, panne transitoire), la requête passait sans filet (`return null`) dans TOUS les cas d'erreur.

**Correctif** : seule la RPC ABSENTE (`42883`/`PGRST202`/message « function ... does not exist » — migration `rate-limits.sql` pas encore passée) fail-open sans filet, ce qui reste le bootstrap volontaire pré-migration. Toute autre panne (réseau, Supabase injoignable, erreur transitoire) retombe désormais sur le compteur mémoire par IP (même filet que le mode anonyme/démo), côté RPC-en-erreur **et** côté exception réseau. Borne le risque de coût IA en cas d'incident, sans jamais bloquer l'usage normal pré-migration.

---

## F5 — Basse — Relais d'email d'invitation vers adresse arbitraire — ✅ Corrigé (2026-07-16)

**Fichier** : `src/app/api/send-invite-email/route.ts:19-70`.

Tout utilisateur authentifié (pas forcément propriétaire de l'arbre) pouvait déclencher l'envoi d'un email à n'importe quelle adresse, avec `inviterName`/`treeName` contrôlés par l'attaquant.

**Correctif** : la route accepte désormais `treeId` et vérifie explicitement `guardTreeWrite(treeId, 'owner')` (même backend que les données, Supabase ou Railway) avant tout envoi — l'appelant doit être PROPRIÉTAIRE de l'arbre référencé. Rate-limit dédié ajouté (30/h/utilisateur, `RATE_LIMITS['/api/send-invite-email']`).

---

## F6 — Basse — Fail-open pré-migration (`42703`) — ✅ Vérifié (2026-07-16)

**Fichiers** : `send-approval/route.ts:35`, `proxy.ts:45-46`.

Vérification (pas de changement de code nécessaire) : les deux endroits testent l'égalité EXACTE avec le code Postgres `42703` (colonne absente), jamais un catch-all générique — toute AUTRE erreur (ligne absente, panne transitoire) échoue fermé. Choix de bootstrap correctement scopé ; la prod a les colonnes depuis le schéma initial → risque nul en régime établi. Conservé tel quel pour la résilience à un éventuel rollback de schéma.

---

## F7 — Basse/Info — CSRF non explicitement mitigé — ✅ Corrigé (2026-07-16)

Les mutations s'authentifiaient par cookie de session (web), sans vérification explicite d'`Origin`/`Referer` — protection seulement implicite via `SameSite` des cookies Supabase (qui reste le filet principal).

**Correctif** : nouveau helper `checkOrigin()` (`apiData.ts`, via `next/headers`) comparant l'en-tête `Origin` (envoyé par tout navigateur sur une requête state-changing) à l'hôte de la requête — absent (curl, apps mobiles en Bearer) → laissé passer (fail-open volontaire) ; présent mais divergent → 403. Branché dans `guardTreeWrite` (couvre `/api/data/trees/*` + `collaboration/*`) et explicitement dans les routes mutation hors `apiData.ts` (`data/rpc/[name]`, `collaboration/suggestions/resolve`, `send-approval(-email)`, `push/register`, `push/notify-join`, `storage/sign-upload`, `storage/delete`).

---

## Points vérifiés — sans finding (bonnes pratiques confirmées)

- **Guards AuthZ systématiques** : toutes les routes `/api/data/*` passent par un guard avant toute lecture/écriture. Aucune route « oubliée » trouvée. AuthZ tourne via `store.authz` → même backend que les données.
- **`isOwner` recalculé côté serveur** : un partenaire `write` ne peut pas voler la propriété d'un arbre. `author_id`/`invitedBy` dérivés de la session, jamais du corps de requête.
- **AuthN robuste** : `getServerAuth` utilise `auth.getUser()` (validation serveur du JWT), pas `getSession()` (simple décodage) → token forgé/expiré rejeté.
- **Injection SQL : aucune.** Requêtes 100% paramétrées ; les seules interpolations de chaîne sont des noms de table/colonne issus d'une whitelist statique, jamais d'entrée utilisateur.
- **Gardes cross-tenant explicites** dans `upsertRows`, `preserveExtra`, `deleteChildRows`, `detectDeleteConflicts` — un id collisionnant d'un autre arbre ne peut ni être écrasé ni faire fuiter son `extra`.
- **Whitelist RPC stricte** : rejet 403 avant tout forward, jamais d'identifiant SQL interprété depuis l'entrée utilisateur.
- **Partage public** : journal jamais exposé, fiches privées filtrées deux fois, colonnes en allowlist (voir F2 pour la divergence de datastore, distincte de cette logique).
- **Secrets** : aucun secret en dur dans `src/`. `/api/health` est admin-only et ne renvoie que la présence (booléen) des secrets. Messages d'erreur DB génériques au client.
- **XSS** : `react-markdown` sans `rehype-raw` (HTML brut échappé par défaut). `dangerouslySetInnerHTML` limité à du contenu statique. Emails HTML échappés avant interpolation.
- **Stockage objet R2** : validation stricte du chemin (1er segment = userId, anti path-traversal), appliquée identiquement sur upload et delete. URLs présignées 5 minutes.
- **Dépendances** : versions récentes (Next 16.2.6, React 19.2.4, @supabase/ssr 0.10.3, pg 8.22.0), aucune version notoirement vulnérable reconnue.

---

## Recommandations priorisées

1. ~~**F1 (Haute) — à corriger sans délai**~~ **✅ Fait (2026-07-16)** : `stripUnauthorizedJournal` appliqué sur les deux routes de lecture (`/api/data/trees`, `/api/data/trees/[id]`), aux deux backends par défense en profondeur.
2. ~~**F2 (Moyenne)**~~ **✅ Fait (2026-07-16)**, en même temps que le correctif architecture F1 (partage/`DataStore`).
3. ~~**F3 (Moyenne)**~~ **✅ Fait (2026-07-16)** : clé MMKV via `expo-secure-store` + `recrypt()` en place — **à valider manuellement sur device réel avant déploiement** (voir note F3 ci-dessus).

**Mise à jour (2026-07-16)** : F1 à F7 tous corrigés ou vérifiés (voir tableau de synthèse) — `tsc`/`eslint` propres côté web, `tsc` propre + `expo export` (bundling JS OK) côté mobile, `e2e/authz.spec.ts` (23/23). Seul point restant : validation de F3 sur un vrai appareil/simulateur mobile, hors de portée de cet environnement d'exécution.
