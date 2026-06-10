// Real-time collaboration helpers: person comments + tree presence.
// All functions no-op gracefully when Supabase isn't configured (guest/demo),
// so callers can use them unconditionally.
import { supabase } from './supabase';

export interface PersonComment {
  id: string;
  treeId: string;
  personId: string;
  authorId: string | null;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

/** True when comments/presence can actually talk to a backend. */
export const collaborationEnabled = (): boolean => !!supabase;

interface CommentRow {
  id: string;
  tree_id: string;
  person_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

function mapRow(r: CommentRow): PersonComment {
  return {
    id: r.id,
    treeId: r.tree_id,
    personId: r.person_id,
    authorId: r.author_id,
    authorName: r.author_name,
    content: r.content,
    createdAt: r.created_at,
  };
}

/** Comments for a person, oldest first. Returns [] when offline. */
export async function fetchComments(treeId: string, personId: string): Promise<PersonComment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('person_comments')
    .select('*')
    .eq('tree_id', treeId)
    .eq('person_id', personId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as CommentRow[]).map(mapRow);
}

/** Post a comment. Returns the saved row, or null on failure / offline. */
export async function addComment(
  treeId: string,
  personId: string,
  content: string,
  author: { id: string; name: string },
): Promise<PersonComment | null> {
  if (!supabase) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('person_comments')
    .insert({ tree_id: treeId, person_id: personId, author_id: author.id, author_name: author.name, content: trimmed })
    .select('*')
    .single();
  if (error || !data) return null;
  return mapRow(data as CommentRow);
}

/**
 * Subscribe to new comments for a person (realtime INSERTs).
 * Returns an unsubscribe function (safe to call when offline).
 */
export function subscribeComments(personId: string, onInsert: (c: PersonComment) => void): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  const channel = sb
    .channel(`comments-${personId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'person_comments', filter: `person_id=eq.${personId}` },
      (payload) => onInsert(mapRow(payload.new as CommentRow)),
    )
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

/**
 * Join a tree's presence channel and broadcast self. `onSync` receives the
 * OTHER connected users (excluding `me`). Returns a leave function.
 */
export function joinTreePresence(
  treeId: string,
  me: PresenceUser,
  onSync: (others: PresenceUser[]) => void,
): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  const channel = sb.channel(`tree-presence-${treeId}`, { config: { presence: { key: me.id } } });

  const collect = () => {
    const state = channel.presenceState() as Record<string, PresenceUser[]>;
    const others: PresenceUser[] = [];
    for (const key of Object.keys(state)) {
      if (key === me.id) continue;
      const entry = state[key]?.[0];
      if (entry) others.push({ id: entry.id ?? key, name: entry.name ?? '', color: entry.color ?? 'var(--accent)' });
    }
    onSync(others);
  };

  channel
    .on('presence', { event: 'sync' }, collect)
    .on('presence', { event: 'join' }, collect)
    .on('presence', { event: 'leave' }, collect)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track(me);
    });

  return () => { sb.removeChannel(channel); };
}

/** Deterministic on-brand-ish color from a user id (for presence avatars + cursors). */
export function presenceColor(id: string): string {
  const palette = ['#bf4b2c', '#2d6a4f', '#1d3557', '#6d2b7a', '#b5838d', '#4a7c59', '#264653', '#e9c46a'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// ===== Edit suggestions =====

export interface PersonSuggestion {
  id: string;
  treeId: string;
  personId: string;
  authorId: string | null;
  authorName: string | null;
  field: string;
  currentValue: string | null;
  suggestedValue: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface SuggestionRow {
  id: string;
  tree_id: string;
  person_id: string;
  author_id: string | null;
  author_name: string | null;
  field: string;
  current_value: string | null;
  suggested_value: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

function mapSuggestion(r: SuggestionRow): PersonSuggestion {
  return {
    id: r.id, treeId: r.tree_id, personId: r.person_id,
    authorId: r.author_id, authorName: r.author_name,
    field: r.field, currentValue: r.current_value, suggestedValue: r.suggested_value,
    status: r.status, createdAt: r.created_at,
  };
}

/** Pending suggestions for a tree (optionally a single person), oldest first. */
export async function fetchPendingSuggestions(treeId: string, personId?: string): Promise<PersonSuggestion[]> {
  if (!supabase) return [];
  let q = supabase.from('person_suggestions').select('*').eq('tree_id', treeId).eq('status', 'pending');
  if (personId) q = q.eq('person_id', personId);
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as SuggestionRow[]).map(mapSuggestion);
}

/** Count pending suggestions for a tree (for the sidebar badge). */
export async function countPendingSuggestions(treeId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('person_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('tree_id', treeId)
    .eq('status', 'pending');
  return error ? 0 : (count ?? 0);
}

export async function addSuggestion(s: {
  treeId: string; personId: string; field: string; currentValue: string | null; suggestedValue: string;
  author: { id: string; name: string };
}): Promise<PersonSuggestion | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('person_suggestions')
    .insert({
      tree_id: s.treeId, person_id: s.personId, author_id: s.author.id, author_name: s.author.name,
      field: s.field, current_value: s.currentValue, suggested_value: s.suggestedValue,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return mapSuggestion(data as SuggestionRow);
}

/** Accept or reject a suggestion. Returns success. */
export async function resolveSuggestion(id: string, status: 'accepted' | 'rejected'): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('person_suggestions').update({ status }).eq('id', id);
  return !error;
}

// ===== Live cursors (presence with position) =====

export interface CursorPeer {
  id: string;
  name: string;
  color: string;
  x?: number;
  y?: number;
  /** Which layout the coordinates belong to (vertical pan/zoom space vs fan SVG space). */
  layout?: 'vertical' | 'fan';
  /** Last-update timestamp (ms) — used to fade stale cursors. */
  t?: number;
}

/**
 * Join a tree's cursor presence channel. `onPeers` receives the OTHER users
 * (with their latest cursor position). Call `move(x, y)` (already throttled by
 * the caller) to broadcast self. Returns `{ move, leave }`. No-op when offline.
 */
export function joinTreeCursors(
  treeId: string,
  me: { id: string; name: string; color: string },
  onPeers: (peers: CursorPeer[]) => void,
): { move: (x: number, y: number, layout?: 'vertical' | 'fan') => void; leave: () => void } {
  if (!supabase) return { move: () => {}, leave: () => {} };
  const sb = supabase;
  const channel = sb.channel(`tree-cursors-${treeId}`, { config: { presence: { key: me.id } } });

  const collect = () => {
    const state = channel.presenceState() as Record<string, CursorPeer[]>;
    const peers: CursorPeer[] = [];
    for (const key of Object.keys(state)) {
      if (key === me.id) continue;
      const e = state[key]?.[0];
      if (e) peers.push({ id: e.id ?? key, name: e.name ?? '', color: e.color ?? 'var(--accent)', x: e.x, y: e.y, layout: e.layout, t: e.t });
    }
    onPeers(peers);
  };

  let ready = false;
  channel
    .on('presence', { event: 'sync' }, collect)
    .on('presence', { event: 'join' }, collect)
    .on('presence', { event: 'leave' }, collect)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') { ready = true; channel.track({ ...me }); }
    });

  return {
    move: (x: number, y: number, layout: 'vertical' | 'fan' = 'vertical') => { if (ready) channel.track({ ...me, x, y, layout, t: Date.now() }); },
    leave: () => { sb.removeChannel(channel); },
  };
}
