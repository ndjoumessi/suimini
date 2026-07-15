/**
 * Client du relais temps réel Railway (mobile — miroir de src/lib/realtimeRelay.ts).
 *
 * ADDITIF ET RÉVERSIBLE. Derrière `EXPO_PUBLIC_REALTIME_BACKEND=railway`
 * (+ `EXPO_PUBLIC_REALTIME_URL`). Flag absent → `isRailwayRealtimeEnabled()` renvoie
 * false et RIEN ne change (le resync-au-retour-de-premier-plan d'AppState reste le
 * seul mécanisme, inchangé). Sur signal, l'appelant fait `refreshFromRemote()` —
 * le relais ne transporte aucune donnée de fiche.
 *
 * WebSocket est un global React Native (pas de dépendance à ajouter).
 */

export interface RelayMessage {
  t: string;
  tbl?: string;
  op?: string;
  type?: string;
}

export interface TreeRelayHandle {
  close(): void;
}

export interface ConnectTreeRelayOptions {
  url: string;
  treeId: string;
  getToken: () => Promise<string | null>;
  onChange: (msg: RelayMessage) => void;
}

export function isRailwayRealtimeEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_REALTIME_BACKEND === 'railway' &&
    !!process.env.EXPO_PUBLIC_REALTIME_URL
  );
}

export function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const j = JSON.parse(raw) as Partial<RelayMessage>;
    if (!j || typeof j.t !== 'string' || !j.t) return null;
    return { t: j.t, tbl: j.tbl, op: j.op, type: j.type };
  } catch {
    return null;
  }
}

export function isChangeForTree(msg: RelayMessage | null, treeId: string): boolean {
  return !!msg && msg.type !== 'subscribed' && msg.t === treeId;
}

/** Construit l'URL WS avec treeId + token en query (RN WebSocket ne pose pas d'en-têtes). */
function buildUrl(base: string, treeId: string, token: string): string | null {
  try {
    const u = new URL(base);
    u.searchParams.set('treeId', treeId);
    u.searchParams.set('token', token);
    if (u.pathname === '/' || u.pathname === '') u.pathname = '/realtime';
    return u.toString();
  } catch {
    return null;
  }
}

export function connectTreeRelay(opts: ConnectTreeRelayOptions): TreeRelayHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectDelay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };
  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    const delay = reconnectDelay;
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; void open(); }, delay);
  };

  const open = async () => {
    if (closed) return;
    const token = await opts.getToken();
    if (closed) return;
    if (!token) { scheduleReconnect(); return; }
    const url = buildUrl(opts.url, opts.treeId, token);
    if (!url) return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => { reconnectDelay = 1000; };
    ws.onmessage = (ev: WebSocketMessageEvent) => {
      const msg = parseRelayMessage(typeof ev.data === 'string' ? ev.data : '');
      if (isChangeForTree(msg, opts.treeId)) opts.onChange(msg as RelayMessage);
    };
    ws.onerror = () => { /* onclose suit */ };
    ws.onclose = () => { if (!closed) scheduleReconnect(); };
  };

  void open();

  return {
    close() {
      closed = true;
      clearReconnect();
      if (ws) {
        try { ws.close(); } catch { /* ignore */ }
        ws = null;
      }
    },
  };
}
