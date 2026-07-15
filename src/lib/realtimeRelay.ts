/**
 * Client du relais temps réel Railway (web).
 *
 * ADDITIF ET RÉVERSIBLE. Derrière le flag `NEXT_PUBLIC_REALTIME_BACKEND=railway`
 * (+ `NEXT_PUBLIC_REALTIME_URL`). Flag absent/`legacy` → `isRailwayRealtimeEnabled()`
 * renvoie false et RIEN ne change (le canal Supabase historique reste tel quel,
 * inerte mais inchangé). Comme le flag Storage R2, c'est un `NEXT_PUBLIC_*`
 * (build-time) : le flip demande un redeploy — voir docs/railway-realtime-plan.md.
 *
 * Rôle : ouvrir un WebSocket vers le service `scripts/realtime-relay/`, s'abonner
 * à UN arbre (le `treeId` actif, comme le `filter: tree_id=eq.…` du canal Supabase),
 * et appeler `onChange` à chaque signal. Le contenu réel est rechargé par
 * l'appelant (`reloadTreeFromCloud`) via l'API authentifiée habituelle — le relais
 * ne transporte aucune donnée de fiche.
 */

export interface RelayMessage {
  t: string;        // tree_id concerné
  tbl?: string;
  op?: string;
  type?: string;    // 'subscribed' pour l'ack initial
}

export interface TreeRelayHandle {
  close(): void;
}

export interface ConnectTreeRelayOptions {
  url: string;                                  // NEXT_PUBLIC_REALTIME_URL (wss://…)
  treeId: string;
  getToken: () => Promise<string | null>;       // access_token frais (peut expirer → relu à chaque (re)connexion)
  onChange: (msg: RelayMessage) => void;        // signal « cet arbre a changé »
  onStatus?: (status: 'open' | 'closed') => void;
}

/** Le temps réel Railway est-il activé (flag + URL présents) ? */
export function isRailwayRealtimeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_REALTIME_BACKEND === 'railway' &&
    !!process.env.NEXT_PUBLIC_REALTIME_URL
  );
}

/** Parse un message brut du relais (pur → testable). `null` si illisible/sans tree_id. */
export function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const j = JSON.parse(raw) as Partial<RelayMessage>;
    if (!j || typeof j.t !== 'string' || !j.t) return null;
    return { t: j.t, tbl: j.tbl, op: j.op, type: j.type };
  } catch {
    return null;
  }
}

/** Un message concerne-t-il l'arbre abonné et n'est-il pas le simple ack ? (pur) */
export function isChangeForTree(msg: RelayMessage | null, treeId: string): boolean {
  return !!msg && msg.type !== 'subscribed' && msg.t === treeId;
}

/**
 * Ouvre l'abonnement WebSocket pour un arbre. Reconnexion automatique avec backoff
 * (le jeton est relu à CHAQUE connexion → gère l'expiration du access_token).
 * Renvoie un handle `close()` idempotent (à appeler au démontage / changement d'arbre).
 */
export function connectTreeRelay(opts: ConnectTreeRelayOptions): TreeRelayHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectDelay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => { if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } };

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
    if (!token) { scheduleReconnect(); return; }         // pas de session → réessayer plus tard
    let url: string;
    try {
      const u = new URL(opts.url);
      u.searchParams.set('treeId', opts.treeId);
      u.searchParams.set('token', token);
      // Chemin par défaut du relais si l'URL n'en précise pas.
      if (u.pathname === '/' || u.pathname === '') u.pathname = '/realtime';
      url = u.toString();
    } catch {
      return;                                             // URL invalide → ne rien faire (fail-safe)
    }
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect(); return;
    }
    ws.onopen = () => { reconnectDelay = 1000; opts.onStatus?.('open'); };
    ws.onmessage = (ev) => {
      const msg = parseRelayMessage(typeof ev.data === 'string' ? ev.data : '');
      if (isChangeForTree(msg, opts.treeId)) opts.onChange(msg as RelayMessage);
    };
    ws.onerror = () => { /* onclose suit → reconnexion */ };
    ws.onclose = () => {
      opts.onStatus?.('closed');
      if (!closed) scheduleReconnect();
    };
  };

  void open();

  return {
    close() {
      closed = true;
      clearReconnect();
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        try { ws.close(); } catch { /* ignore */ }
        ws = null;
      }
    },
  };
}
