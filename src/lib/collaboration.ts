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

/** Deterministic on-brand-ish color from a user id (for presence avatars). */
export function presenceColor(id: string): string {
  const palette = ['#bf4b2c', '#2c5f8a', '#0e6e63', '#c77d1a', '#a8456b', '#6e6a62'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
