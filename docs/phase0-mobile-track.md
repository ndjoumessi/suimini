# Phase 0 — Track mobile (chemin critique du zéro-downtime)

> Le web est passé derrière l'API (`/api/data/*`). Le **mobile** (Expo, projet
> `mobile/`) parle **encore Supabase en direct** — et c'est OK **tant que la DB
> reste Supabase + RLS**. Ce document cadre sa migration, à faire **avant** le
> cutover DB (Railway), sinon les vieux builds natifs casseront.

## Pourquoi le mobile est le vrai risque

On ne peut **pas forcer** une mise à jour d'app native : un utilisateur sur un
ancien build continue de taper Supabase en direct. Donc :

- **Aujourd'hui (DB = Supabase)** : mobile direct = aucun problème. Rien à faire
  dans l'urgence.
- **Au cutover DB (Supabase → Railway)** : la DB Supabase disparaît. Tout build
  mobile qui tape Supabase en direct **casse**. Il faut donc que **100 % des
  utilisateurs actifs** soient sur un build « API » AVANT de couper.

## Surface mobile à migrer (miroir du web)

`mobile/lib/supabaseSync.ts` (persons/relationships/journal), `mobile/hooks/useAuth.ts`
(auth — track Clerk séparé), `mobile/lib/uploadImage.ts` (storage — track R2),
`mobile/lib/store.ts` (`refreshFromRemote`, `upsertPerson`, `removePerson`). Même
`DataClient`/`ApiDataClient` conceptuel que le web, mais **dupliqué** (projet
séparé, pas d'import cross-projet — cf. CLAUDE.md).

## Plan

1. **Porter `DataClient` côté mobile** : `mobile/lib/dataClient.ts` (miroir du web)
   + `ApiDataClient` visant `EXPO_PUBLIC_API_BASE_URL` (l'origine Vercel, pas une
   URL relative — le natif n'a pas d'origine). Auth : envoyer le JWT Supabase en
   `Authorization: Bearer` (le mobile n'a pas de cookies same-origin) → adapter
   `getServerAuth` pour accepter **Bearer** en plus du cookie (déjà le cas pour
   `/api/push/register`).
2. **Versionner l'API** (`/api/data/v1/...`) ou garantir la rétro-compat, pour
   qu'un ancien et un nouveau build coexistent pendant la fenêtre de bascule.
3. **Flag mobile** `EXPO_PUBLIC_DATA_LAYER` (miroir du web) : shipper d'abord un
   build qui sait faire les deux, défaut `direct`.
4. **Forcer l'adoption** : `expo-updates` (OTA) pour pousser le JS « API » sans
   store review, + un **kill-switch** « version minimale requise » qui bloque les
   builds trop anciens (écran « Mettez à jour »).
5. **Observer** l'adoption (part des requêtes API vs directes) jusqu'à ~100 %.
6. **Seulement alors** : cutover DB (Railway) + Realtime→Pusher.

## Dépendances AuthN à régler avant

`getServerAuth` (web) lit la session par **cookie**. Le mobile devra passer par
**Bearer JWT**. À factoriser : `getServerAuth` acceptant cookie **OU**
`Authorization: Bearer <supabase access_token>` (valider via `auth.getUser(jwt)`),
puis construire le même client lié à l'identité. Petit refactor, à faire au début
du track mobile.

## État

- **Web** : derrière l'API (flag `DATA_LAYER`). ✅
- **Mobile — MIGRÉ (2026-07-12)** : `mobile/lib/supabaseSync.ts` (nom conservé,
  contenu réécrit) parle désormais à `/api/data/*` via `EXPO_PUBLIC_API_BASE_URL`
  (défaut `https://suimini.vercel.app`) + `Authorization: Bearer <access_token>`,
  exactement le plan ci-dessus (étape 1). `store.ts` mis à jour en conséquence
  (`upsertPerson`/`removePerson`/`addRelationship`/`removeRelationship` passent
  désormais l'arbre courant ou les ids de relations affectées, requis pour
  l'écriture upsert-only côté API).
  - **Déclencheur** : le cutover DB (Railway, §"Backend données — Railway" du
    CLAUDE.md racine) a eu lieu le 2026-07-11 — AVANT ce track mobile, dans
    l'autre ordre que celui prévu ci-dessus. Le mobile parlant encore Supabase
    en direct, il lisait des tables qui ne recevaient plus aucune écriture web
    → données figées côté app (constaté par l'utilisateur : « les modifications
    récentes n'apparaissent pas »).
  - **Étapes 2-5 (versionnage API, flag `EXPO_PUBLIC_DATA_LAYER` double-mode,
    kill-switch OTA, observation d'adoption) volontairement NON implémentées** :
    elles protègent une base d'installations natives déjà en production sur
    d'anciens builds — hors de propos ici, l'app mobile n'est pas encore
    distribuée (tests via Expo Go / builds EAS manuels uniquement, pas de store
    review à contourner). Un cutover direct est donc sûr et suffisant en l'état.
    Si l'app est un jour publiée en store AVANT une future migration backend,
    revenir sur ce doc pour le plan de rollout progressif.
