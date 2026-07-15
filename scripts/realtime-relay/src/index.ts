/**
 * Suimini — Relais temps réel Railway.
 *
 * (a) Maintient UNE connexion Postgres persistante en `LISTEN tree_changes`
 *     (URL DIRECTE / unpooled — LISTEN/NOTIFY ne passe pas PgBouncer).
 * (b) Reçoit les notifications émises par le trigger `notify_tree_change`
 *     (railway/realtime-notify.sql) : payload compact { t: treeId, tbl, op }.
 * (c) Les rediffuse aux clients WebSocket abonnés à CET arbre, après AuthZ
 *     (miroir de canReadTreeAsMember). Coalescence par arbre pour absorber les
 *     rafales d'UPSERT (une édition ré-upserte tout l'arbre).
 *
 * Le relais ne transporte AUCUNE donnée de fiche : le client, sur signal, refait
 * un GET /api/data/trees/[id] authentifié (AuthZ applicative) pour le contenu.
 * Service AUTONOME (Vercel ne tient pas de connexion persistante). Voir
 * docs/railway-realtime-plan.md.
 */
import http from 'node:http';
import { Client, Pool } from 'pg';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, type RelayConfig } from './config';
import { verifyToken, canReadTree, type AuthedUser } from './auth';

export interface NotifyPayload {
  t: string;        // tree_id
  tbl?: string;     // table
  op?: string;      // INSERT | UPDATE | DELETE
}

/** Parse le payload NOTIFY (pur → testable). `null` si illisible ou sans tree_id. */
export function parseNotifyPayload(raw: string | undefined): NotifyPayload | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<NotifyPayload>;
    if (!j || typeof j.t !== 'string' || !j.t) return null;
    return { t: j.t, tbl: typeof j.tbl === 'string' ? j.tbl : undefined, op: typeof j.op === 'string' ? j.op : undefined };
  } catch {
    return null;
  }
}

interface ClientSocket extends WebSocket {
  isAlive?: boolean;
  treeId?: string;
  userId?: string;
}

async function main(): Promise<void> {
  const cfg = loadConfig();

  // Pool pour les requêtes d'AuthZ (courtes, transaction implicite → PgBouncer OK
  // en théorie, mais on utilise la même URL directe par simplicité/robustesse).
  const pool = new Pool({ connectionString: cfg.databaseUrl, ssl: cfg.ssl, max: 5, idleTimeoutMillis: 10_000 });

  // Abonnements : treeId → ensemble de sockets. Un socket = un arbre (comme le
  // canal Supabase historique, un channel par tree).
  const subs = new Map<string, Set<ClientSocket>>();
  // Coalescence : treeId → timer en attente de diffusion.
  const pending = new Map<string, NodeJS.Timeout>();

  function broadcast(payload: NotifyPayload): void {
    const set = subs.get(payload.t);
    if (!set || set.size === 0) return;
    const msg = JSON.stringify(payload);
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch { /* socket en cours de fermeture */ }
      }
    }
  }

  function scheduleBroadcast(payload: NotifyPayload): void {
    // Ne planifie que si des clients écoutent CET arbre (économise le debounce).
    if (!subs.get(payload.t)?.size) return;
    if (pending.has(payload.t)) return;                // déjà planifié dans la fenêtre
    const timer = setTimeout(() => {
      pending.delete(payload.t);
      broadcast(payload);
    }, cfg.coalesceMs);
    if (typeof timer.unref === 'function') timer.unref();
    pending.set(payload.t, timer);
  }

  // ── Connexion LISTEN persistante (reconnexion avec backoff) ────────────────
  let listenClient: Client | null = null;
  let reconnectDelay = 1000;
  async function connectListen(): Promise<void> {
    const client = new Client({ connectionString: cfg.databaseUrl, ssl: cfg.ssl });
    client.on('error', (err) => {
      console.error('[relay] erreur connexion LISTEN:', err.message);
      // La fermeture déclenchera scheduleReconnect via le catch/finally ci-dessous.
      try { client.end(); } catch { /* déjà fermée */ }
    });
    client.on('notification', (msg) => {
      const payload = parseNotifyPayload(msg.payload);
      if (payload) scheduleBroadcast(payload);
    });
    client.on('end', () => {
      if (listenClient === client) { listenClient = null; scheduleReconnect(); }
    });
    await client.connect();
    await client.query('LISTEN tree_changes');
    listenClient = client;
    reconnectDelay = 1000;                              // reset après succès
    console.log('[relay] LISTEN tree_changes actif.');
  }
  let reconnectTimer: NodeJS.Timeout | null = null;
  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    const delay = reconnectDelay;
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    console.warn(`[relay] reconnexion LISTEN dans ${delay}ms…`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectListen().catch((e) => { console.error('[relay] échec reconnexion:', e.message); scheduleReconnect(); });
    }, delay);
  }

  await connectListen();

  // ── Serveur HTTP (health) + WebSocket ─────────────────────────────────────
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, listen: !!listenClient, trees: subs.size }));
      return;
    }
    res.writeHead(404); res.end();
  });

  const wss = new WebSocketServer({ server, path: '/realtime' });

  wss.on('connection', async (ws: ClientSocket, req) => {
    try {
      // Contrôle d'origine (défense en profondeur ; le vrai gardien reste l'AuthZ).
      const origin = req.headers.origin;
      if (cfg.allowedOrigins.length && origin && !cfg.allowedOrigins.includes(origin)) {
        ws.close(4403, 'origin interdite'); return;
      }
      const url = new URL(req.url ?? '', 'http://localhost');
      const treeId = url.searchParams.get('treeId') ?? '';
      // Jeton : query `token` OU sous-protocole `bearer,<token>` (RN/navigateur).
      const token = url.searchParams.get('token') ?? bearerFromProtocol(req.headers['sec-websocket-protocol']);
      if (!treeId || !token) { ws.close(4400, 'treeId/token requis'); return; }

      const user: AuthedUser | null = await verifyToken(cfg, token);
      if (!user) { ws.close(4401, 'jeton invalide'); return; }

      const allowed = await canReadTree(pool, treeId, user).catch(() => false);
      if (!allowed) { ws.close(4403, 'accès refusé'); return; }

      ws.treeId = treeId;
      ws.userId = user.userId;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => { subs.get(treeId)?.delete(ws); });
      ws.on('error', () => { try { ws.close(); } catch { /* ignore */ } });

      let set = subs.get(treeId);
      if (!set) { set = new Set(); subs.set(treeId, set); }
      set.add(ws);

      // Ack minimal (le client peut ignorer) — confirme l'abonnement.
      try { ws.send(JSON.stringify({ type: 'subscribed', t: treeId })); } catch { /* ignore */ }
    } catch (e) {
      console.error('[relay] erreur handshake:', e instanceof Error ? e.message : e);
      try { ws.close(1011, 'erreur serveur'); } catch { /* ignore */ }
    }
  });

  // Heartbeat : ferme les sockets morts (proxies qui coupent silencieusement).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<ClientSocket>) {
      if (ws.isAlive === false) { try { ws.terminate(); } catch { /* ignore */ } continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, 30_000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  server.listen(cfg.port, () => console.log(`[relay] écoute sur :${cfg.port} (ws path /realtime)`));

  // Arrêt propre.
  const shutdown = () => {
    console.log('[relay] arrêt…');
    clearInterval(heartbeat);
    for (const ws of wss.clients) { try { ws.close(1001, 'arrêt serveur'); } catch { /* ignore */ } }
    server.close();
    try { listenClient?.end(); } catch { /* ignore */ }
    pool.end().catch(() => {});
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/** Extrait un jeton d'un `Sec-WebSocket-Protocol: bearer, <token>`. */
function bearerFromProtocol(header: string | string[] | undefined): string {
  if (!header) return '';
  const parts = (Array.isArray(header) ? header.join(',') : header).split(',').map((s) => s.trim());
  const i = parts.indexOf('bearer');
  return i >= 0 && parts[i + 1] ? parts[i + 1] : '';
}

main().catch((e) => { console.error('[relay] fatal:', e); process.exit(1); });
