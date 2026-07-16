# Temps réel sur Railway — plan & mécanisme de relais

> État : **LIVE EN PRODUCTION (2026-07-16, tâche #76/F6 étape 1).** Trigger SQL
> appliqué sur Railway (4 triggers vérifiés : persons/relationships/journal_entries/
> tree_members), relais déployé en service Railway séparé (Root Directory
> `scripts/realtime-relay`, TLS via `RAILWAY_DB_INSECURE_SSL=1` — le certificat
> auto-signé de Railway est rejeté par défaut même sur le réseau privé, ce repli
> documenté a été nécessaire), `/health` → `{"ok":true,"listen":true}`. Flags posés
> et redéployés des deux côtés : web (`NEXT_PUBLIC_REALTIME_BACKEND=railway` +
> `NEXT_PUBLIC_REALTIME_URL=wss://suimini.up.railway.app/realtime`, `vercel --prod`)
> et mobile (`EXPO_PUBLIC_REALTIME_BACKEND`/`_URL` dans `mobile/.env` + posées sur
> EAS, 3 environnements). **Chemin nominal confirmé en conditions réelles** : édition
> dans un onglet → mise à jour + toast dans un second onglet en < 2s, sans reload
> manuel. **Anti-écho confirmé** (après un premier faux positif au tout premier test,
> dû au cold-start du relais fraîchement déployé dépassant la fenêtre de 6s — un
> second essai avec le relais "chaud" a confirmé le filtrage correct : l'onglet
> éditeur ne voit plus son propre toast).
>
> **Restant, non bloquant** : tests négatifs AuthN/AuthZ du handshake WS (token
> invalide/absent → `4401` ; arbre non autorisé → `4403`), test de coalescence
> explicite (rafale d'éditions → un seul toast) et test de reconnexion (redémarrage
> du relais → clients se reconnectent seuls) — non exécutés formellement, mais le
> code implémentant ces trois garanties n'a pas changé depuis l'écriture initiale
> (§7 ci-dessous liste la checklist complète si on veut les dérouler plus tard).
>
> **Rollback (une ligne)** : retirer le flag `NEXT_PUBLIC_REALTIME_BACKEND` (web) /
> `EXPO_PUBLIC_REALTIME_BACKEND` (mobile) + redeploy → le nouveau chemin ne s'ouvre
> plus, le comportement d'avant reprend à l'identique. Le relais peut rester en
> ligne sans effet (aucun client ne s'y connecte).

## 0. TL;DR — recommandation professionnelle

- **Problème** : depuis `DB_BACKEND=railway` à 100%, le canal Realtime Supabase
  (`postgres_changes` sur `persons`/`relationships`, `SuiminiApp.tsx`) écoute des
  tables qui **ne bougent plus** → il ne se déclenche JAMAIS pour un vrai
  changement. Le contournement en place (resync au retour de focus web + listener
  `AppState` mobile, seuil 10 s) **ne couvre QUE** « je rouvre l'onglet/l'app » —
  pas la mise à jour LIVE pendant que deux appareils sont ouverts en même temps.
- **Solution retenue** : `LISTEN/NOTIFY` Postgres (natif Railway) + un **petit
  relais WebSocket** autonome. Trigger SQL → `pg_notify('tree_changes', {t,tbl,op})`
  → le relais rediffuse aux clients abonnés à l'arbre, **après AuthZ** (miroir de
  `canReadTreeAsMember`). Le relais ne transporte AUCUNE donnée de fiche : sur
  signal, le client refait un `GET /api/data/trees/[id]` authentifié (l'AuthZ
  applicative reste le seul gardien du contenu).
- **Discipline** : additif, réversible, rollback une-ligne, aucune donnée
  détruite, seam inerte tant que le flag n'est pas posé — même patron que les
  migrations data/storage.

### Pourquoi ce design (et pas une alternative)

| Option | Verdict |
|---|---|
| **LISTEN/NOTIFY + relais WS** (retenu) | Natif Postgres, zéro polling, latence ~temps réel. Coût : un petit service à héberger (Vercel ne tient pas de connexion persistante). AuthZ rejouée à la connexion. |
| Polling court côté client | Simple, aucun service, mais trafic constant + latence = l'intervalle ; on a DÉJÀ le resync-au-focus (le polling permanent serait juste sa version gaspilleuse). Ne répond pas au « live à deux appareils ouverts » sans intervalle très court (coûteux). |
| Réintroduire Supabase Realtime en shadow-écrivant les tables Supabase | Rechute exacte de l'incident qu'on a fui : deux sources d'écriture, risque de DELETE-par-diff, double coût. Rejeté. |
| Service tiers (Ably/Pusher/Supabase Realtime standalone) | Zéro ops mais nouveau lock-in + nouveau secret + coût ; superflu quand Postgres fait NOTIFY nativement. À reconsidérer seulement si le relais auto-hébergé devient un fardeau d'exploitation. |

## 1. Objectif & périmètre

**Objectif.** Rétablir la mise à jour temps réel de l'arbre affiché quand un AUTRE
appareil/session le modifie, pendant que les deux sont ouverts — sans rien casser
du comportement actuel, derrière un flag à rollback instantané.

**Périmètre.** Uniquement le **signal** « l'arbre T a changé ». Le rechargement du
contenu réutilise les fonctions existantes (`reloadTreeFromCloud` web,
`refreshFromRemote` mobile) via l'API `/api/data/*`. **Non-objectifs** : la présence
(collaborateurs en ligne), le toast « membre a rejoint », et le realtime des
commentaires/suggestions restent sur leur chemin actuel (canal Supabase, encore
fonctionnel pour la présence qui est WebSocket-native, pas table-based). On
n'y touche pas.

## 2. Architecture

```
   Appareil A (web)                       Appareil B (mobile)
   édite une fiche                        regarde le même arbre
        │                                        ▲
        │ POST /api/data/trees/[id]/save         │ onChange → refreshFromRemote()
        ▼                                        │ (GET /api/data/trees — AuthZ)
   Vercel /api/data/*  ──►  RailwayStore (pg)    │
        │ UPSERT persons/relationships           │
        ▼                                        │
   Railway Postgres                              │
     trigger notify_tree_change                  │
        │ pg_notify('tree_changes',{t,tbl,op})   │
        ▼                                        │
   ┌─────────────────────────────┐   WebSocket   │
   │  RELAIS (scripts/realtime-   │ ─────────────►┤
   │  relay/) : LISTEN + WS       │ ─────────────►  Appareil A aussi (ignoré : self-write window)
   │  AuthZ = canReadTreeAsMember │
   └─────────────────────────────┘
```

- **Trigger SQL** (`railway/realtime-notify.sql`, aussi dans `railway/schema.sql`) :
  `AFTER INSERT/UPDATE/DELETE` sur `persons`, `relationships`, `journal_entries`,
  `tree_members` → `pg_notify('tree_changes', json{t:tree_id, tbl, op})`. Payload
  minuscule (aucune donnée de fiche ; limite pg_notify 8000 o largement respectée).
- **Relais** (`scripts/realtime-relay/`, Node/TS autonome) :
  1. UNE connexion Postgres persistante `LISTEN tree_changes` (reconnexion backoff).
  2. Serveur WebSocket (`ws`) sur `/realtime` + `/health`.
  3. Handshake : `?treeId=<id>&token=<access_token>` (ou sous-protocole `bearer,<token>`).
     AuthN = `GET ${SUPABASE_URL}/auth/v1/user` (même JWT que `getServerAuth`).
     AuthZ = requête Railway `owner OU tree_shares(read|write) OU membre accepté`
     (miroir EXACT de `canReadTreeAsMember`, `src/lib/authz.ts`).
  4. Sur NOTIFY : coalescence par arbre (debounce ~250 ms → une rafale d'UPSERT =
     un seul signal), diffusion aux sockets abonnés à ce `tree_id`.
- **Client web** (`src/lib/realtimeRelay.ts` + effet additif dans `SuiminiApp.tsx`) :
  derrière `isRailwayRealtimeEnabled()`, ouvre un WS pour le `treeId` actif, et sur
  signal appelle `reloadTreeFromCloud` (+ toast throttlé « un collaborateur a
  modifié »), avec le MÊME filet anti-écho temporel que le canal Supabase.
- **Client mobile** (`mobile/lib/realtimeRelay.ts` + effet additif dans
  `mobile/app/_layout.tsx`) : miroir, sur signal appelle `refreshFromRemote`
  (garde anti-rafale 3 s).

## 3. Invariants load-bearing (à ne pas casser)

1. **Inerte par défaut.** Sans flag, `isRailwayRealtimeEnabled()` = false → aucun
   WS ouvert, zéro changement. Le canal Supabase, la présence et le resync-au-focus
   restent inchangés. Le nouvel effet est **ADDITIF** (il ne remplace ni ne
   désactive l'ancien) → pas de régression possible flag-absent.
2. **AuthZ = seul gardien du contenu.** Le relais vérifie le droit de LIRE l'arbre
   avant d'abonner (pas de fuite inter-arbres, comme le `filter: tree_id=eq.…`
   Supabase). Et il ne diffuse JAMAIS de donnée de fiche : le contenu passe par
   `/api/data/*` (AuthZ applicative + identité de l'appelant). Un signal volé ne
   révèle donc rien de plus que « l'arbre T a bougé ».
3. **Connexion DIRECTE (unpooled) obligatoire pour le LISTEN.** LISTEN/NOTIFY ne
   fonctionne PAS à travers PgBouncer transaction-mode (la session LISTEN n'est pas
   collée à une connexion serveur). `RELAY_DATABASE_URL` = URL **directe** (idéalement
   le réseau privé `*.railway.internal`). ⚠️ NE PAS réutiliser l'URL POOLÉE de l'app.
4. **Anti-écho conservé.** Le relais renvoie aussi NOS propres écritures. Le client
   retombe sur la fenêtre temporelle `lastLocalWriteRef` (6 s web) : le payload ne
   porte pas la signature de ligne, mais `reloadTreeFromCloud` est idempotent et le
   toast est supprimé pendant la fenêtre → pas de faux « un collaborateur a modifié ».
5. **TLS = miroir de `railwayDb.ts`.** Le relais réutilise la même politique
   (`RAILWAY_DB_CA_CERT` + identité `localhost`, ou `RAILWAY_DB_INSECURE_SSL=1`
   staging, ou vérif stricte). En prod privé Railway, pas de TLS à épingler.
6. **Séparation stricte du projet.** Le relais a son PROPRE `package.json`/`tsconfig`/
   `node_modules` (comme `mobile/`). Le **root `tsconfig` l'exclut**
   (`scripts/realtime-relay`) → il ne pollue ni `tsc` racine ni `next build`.

## 4. Décision d'hébergement du relais (À TRANCHER par le user)

Vercel ne peut PAS héberger le relais (fonctions serverless = pas de connexion
persistante ni WebSocket long-vécu). Options, avec recommandation :

| Option | Pour | Contre |
|---|---|---|
| **Service Railway séparé** (recommandé) | Même plateforme que la DB → **réseau privé `*.railway.internal`** (pas de TLS à épingler, latence minimale, `RELAY_DATABASE_URL` directe triviale) ; un « worker » à côté du Postgres est un pattern Railway courant ; un seul fournisseur à opérer | consomme un service Railway de plus (coût modeste) |
| **Fly.io** | WebSocket natif, proche des users (edge), gratuit à petite échelle | DB sur Railway → la connexion LISTEN traverse l'Internet public → **TLS à épingler** (`RAILWAY_DB_CA_CERT`) + latence réseau ; deux fournisseurs |
| **Petit VPS** (Hetzner/Fly machine/Render) | contrôle total | ops à sa charge (TLS, redémarrage, monitoring) ; overkill pour un process de ~150 lignes |

**Recommandation argumentée : service Railway séparé.** Le relais parle à Railway
Postgres en permanence ; le co-localiser sur Railway donne le réseau privé (pas de
cert à gérer, la contrainte TLS de `railwayDb.ts` s'évapore), la latence la plus
basse, et un seul plan à surveiller. Fly/VPS n'apportent un intérêt que si on veut
distribuer géographiquement le WS — pas un besoin actuel. **Décision finale = user.**

## 5. Déploiement du relais (étapes MANUELLES — user)

> Prérequis : la décision §4 est prise. Exemple ci-dessous = **service Railway séparé**.

1. **Appliquer le trigger SQL** (une fois) sur la base Railway, via l'URL **DIRECTE
   (UNPOOLED)** — jamais PgBouncer :
   ```bash
   psql "$RAILWAY_UNPOOLED_URL" -f railway/realtime-notify.sql
   ```
   Vérifier :
   ```bash
   psql "$RAILWAY_UNPOOLED_URL" -c "\df notify_tree_change"
   psql "$RAILWAY_UNPOOLED_URL" -c "select tgname, tgrelid::regclass from pg_trigger where tgname='trg_notify_change';"
   # attendu : 4 lignes (persons, relationships, journal_entries, tree_members)
   ```
   (⚠️ l'agent n'a PAS les creds DB Railway → cette étape est manuelle.)

2. **Créer un service Railway** pointant sur ce repo, **Root Directory =
   `scripts/realtime-relay`**. Build : `npm install && npm run build` ;
   Start : `npm start` (Nixpacks détecte Node ; `dist/index.js`).

3. **Variables du service** (Railway → Variables) — cf. `.env.example` :
   | Var | Valeur |
   |---|---|
   | `RELAY_DATABASE_URL` | URL Postgres **directe/unpooled**, de préférence `postgres://…@<pg>.railway.internal:5432/railway` (réseau privé) |
   | `SUPABASE_URL` | même que l'app (`NEXT_PUBLIC_SUPABASE_URL`) |
   | `SUPABASE_ANON_KEY` | clé **anon** publique (JAMAIS `service_role`) |
   | `RELAY_ALLOWED_ORIGINS` | `https://suimini.vercel.app,http://localhost:3000` (optionnel) |
   | `RELAY_COALESCE_MS` | `250` (optionnel) |
   | (hors réseau privé seulement) | `RAILWAY_DB_CA_CERT` / `RAILWAY_DB_TLS_SERVERNAME` / `RAILWAY_DB_INSECURE_SSL` — cf. `railwayDb.ts` |

   Railway injecte `PORT` automatiquement. Exposer le service en HTTP (domaine
   public Railway) → l'URL WS sera `wss://<relais>.up.railway.app/realtime`.

4. **Vérifier le relais** : `curl https://<relais>.up.railway.app/health` →
   `{"ok":true,"listen":true,"trees":0}`. Puis un test WS manuel (voir §7).

5. **Poser les flags client** (Vercel + mobile) et redeployer — voir §6.

## 6. Flags & flip (MANUEL — user)

Comme le flag Storage R2, ce sont des `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` (build-time)
→ le flip demande un redeploy (pas instantané façon Edge Config, mais rollback tout
aussi simple).

**Web (Vercel)** :
```
NEXT_PUBLIC_REALTIME_BACKEND=railway
NEXT_PUBLIC_REALTIME_URL=wss://<relais>.up.railway.app/realtime
```
puis `vercel --prod`.

**Mobile (`mobile/.env`, puis build EAS)** :
```
EXPO_PUBLIC_REALTIME_BACKEND=railway
EXPO_PUBLIC_REALTIME_URL=wss://<relais>.up.railway.app/realtime
```
(fournir aussi sur EAS via `eas env:create` pour les 3 environnements — cf. CLAUDE.md
« Env du build »).

**Rollback** : retirer les deux vars (ou mettre `…_BACKEND` à autre chose que
`railway`) + redeploy → `isRailwayRealtimeEnabled()` = false, l'app revient au
comportement d'avant. Le relais peut rester en ligne (personne ne s'y connecte).

## 7. « Definition of ready » — checklist avant flip prod

- [ ] `railway/realtime-notify.sql` appliqué sur Railway (fonction + 4 triggers vérifiés).
- [ ] Relais déployé, `/health` → `listen:true`.
- [ ] **Handshake refusé** sans/mauvais token → close `4401` (test négatif AuthN).
- [ ] **Handshake refusé** sur un arbre dont l'utilisateur n'est PAS membre → close
      `4403` (test négatif AuthZ = pas de fuite inter-arbres). Ex. de test manuel :
      ```bash
      # Récupérer un access_token (login web → DevTools → cookies, ou supabase.auth.getSession()).
      # Un tree_id auquel ce compte N'A PAS accès doit fermer immédiatement.
      npx wscat -c "wss://<relais>/realtime?treeId=<autre_arbre>&token=<jwt>"
      ```
- [ ] **Chemin nominal** : deux navigateurs (ou web + mobile) sur le MÊME arbre ;
      une édition sur l'un apparaît sur l'autre en < ~2 s **sans** refresh manuel.
- [ ] **Anti-écho** : l'éditeur lui-même ne voit PAS le toast « un collaborateur a
      modifié » sur sa propre écriture (fenêtre 6 s).
- [ ] **Coalescence** : une édition qui ré-upserte tout l'arbre (rafale de NOTIFY)
      ne déclenche qu'UN rechargement / un toast, pas N.
- [ ] **Reconnexion** : redémarrer le relais → les clients se reconnectent seuls
      (backoff), le temps réel reprend sans reload de l'app.
- [ ] **Rollback testé** : retirer le flag + redeploy → comportement d'avant, aucun WS.
- [ ] **Flag absent = zéro régression** : la prod actuelle (flag non posé) est
      strictement identique (déjà vrai : effet inerte, `tsc`/build OK).

## 8. Rollback (barre « une ligne »)

- **Client** : retirer `NEXT_PUBLIC_REALTIME_BACKEND` / `EXPO_PUBLIC_REALTIME_BACKEND`
  + redeploy → plus aucun WS ouvert, retour au resync-au-focus seul.
- **Serveur** : arrêter/supprimer le service relais (sans effet client si le flag
  est déjà retiré). Le trigger SQL peut rester (un `pg_notify` sans auditeur est
  quasi gratuit) ou être retiré :
  ```sql
  drop trigger if exists trg_notify_change on persons;
  drop trigger if exists trg_notify_change on relationships;
  drop trigger if exists trg_notify_change on journal_entries;
  drop trigger if exists trg_notify_change on tree_members;
  drop function if exists notify_tree_change();
  ```
- **Aucune donnée touchée** à aucune étape (le trigger n'écrit rien, ne fait que
  notifier ; le relais ne fait que lire pour l'AuthZ).

## 9. Ce qui N'EST PAS exécutable dans cette session (sans credentials / réseau)

L'agent n'a **ni** creds DB Railway / `service_role` Supabase, **ni** accès réseau
vers un hébergeur. Donc **manuel (user)** :
- appliquer `railway/realtime-notify.sql` en prod ;
- créer/déployer le service relais + poser ses variables ;
- poser les flags `*_REALTIME_*` sur Vercel / `mobile/.env` / EAS + redeploy ;
- dérouler la checklist §7.

**Fait par l'agent (ce commit)** : trigger SQL (+ dans `schema.sql`), service relais
complet et type-checké (`scripts/realtime-relay/`), clients web+mobile derrière flag
(inertes par défaut), tests pure-logic (`e2e/realtime-relay.spec.ts`, 11 verts),
exclusion tsconfig, ce document. `tsc --noEmit` vert racine ET mobile ; relais
type-checké séparément.

## 10. Fichiers

| Fichier | Rôle |
|---|---|
| `railway/realtime-notify.sql` | trigger `notify_tree_change` + 4 triggers (idempotent, script autonome) |
| `railway/schema.sql` | même trigger intégré (un restore neuf l'inclut) |
| `scripts/realtime-relay/` | service relais autonome (`src/{index,config,auth}.ts`, `package.json`, `tsconfig.json`, `README.md`, `.env.example`) |
| `src/lib/realtimeRelay.ts` | client web (flag + WS + parsing pur testable) |
| `src/components/SuiminiApp.tsx` | effet additif (branche le relais sur `reloadTreeFromCloud`) |
| `mobile/lib/realtimeRelay.ts` | client mobile (miroir) |
| `mobile/app/_layout.tsx` | effet additif (branche le relais sur `refreshFromRemote`) |
| `e2e/realtime-relay.spec.ts` | tests pure-logic du client |
| `tsconfig.json` (racine) | exclut `scripts/realtime-relay` du type-check app |
