# Suimini — Relais temps réel Railway

Service **autonome** qui rétablit le temps réel après la migration des données vers
Railway. Le canal Supabase `postgres_changes` historique (`SuiminiApp.tsx`) écoute
les tables Supabase, qui ne bougent plus depuis `DB_BACKEND=railway` → il ne se
déclenche jamais. Ce relais écoute Railway via `LISTEN/NOTIFY` et rediffuse aux
clients via WebSocket.

> Conception, invariants, plan de déploiement et rollback : **`docs/railway-realtime-plan.md`**.

## Ce qu'il fait

1. **Une** connexion Postgres persistante en `LISTEN tree_changes` (URL **DIRECTE /
   unpooled** — LISTEN/NOTIFY ne passe pas PgBouncer).
2. Reçoit les `pg_notify` du trigger `notify_tree_change` (`railway/realtime-notify.sql`) :
   payload compact `{ t: treeId, tbl, op }` (aucune donnée de fiche).
3. Rediffuse aux clients WebSocket abonnés à cet arbre, **après AuthZ** (miroir de
   `canReadTreeAsMember` : owner / share / membre accepté).

Le client, sur signal, refait un `GET /api/data/trees/[id]` authentifié (l'AuthZ
applicative reste le gardien du contenu). Le relais ne transporte **jamais** de
données d'arbre.

## Développement local

```bash
cd scripts/realtime-relay
npm install
cp .env.example .env   # renseigner RELAY_DATABASE_URL (unpooled) + SUPABASE_URL/ANON_KEY
npm run dev            # tsx watch
# health : curl http://localhost:8787/health
```

Type-check : `npm run typecheck`. Build : `npm run build` (→ `dist/`), puis `npm start`.

## Protocole WebSocket

- Endpoint : `wss://<relais>/realtime?treeId=<id>&token=<access_token>`
  (le jeton peut aussi passer par le sous-protocole `bearer, <token>`).
- Le serveur répond `{ "type": "subscribed", "t": "<treeId>" }` puis, à chaque
  changement, `{ "t": "<treeId>", "tbl": "...", "op": "..." }`.
- Codes de fermeture : `4400` (treeId/token manquant), `4401` (jeton invalide),
  `4403` (accès refusé / origine interdite).

## Déploiement

Voir `docs/railway-realtime-plan.md` §« Déploiement du relais ». En résumé :
service Railway séparé pointant sur ce sous-dossier, `RELAY_DATABASE_URL` = URL
Postgres **directe** (idéalement `*.railway.internal`), variables Supabase publiques.
