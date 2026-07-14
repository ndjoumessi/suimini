// Multi-member tree sharing (tree_members). All functions degrade to safe
// no-ops when Supabase isn't configured OR the table hasn't been applied yet
// (errors are swallowed so the single-owner app keeps working).
import { supabase } from './supabase';
import { callRpc } from '@/lib/rpcClient';
import { getDataLayer } from '@/lib/dataClient';

export type MemberRole = 'viewer' | 'editor' | 'admin';
export type MemberStatus = 'pending' | 'accepted' | 'declined';
/** Effective role of the current user on a tree (owner is implicit, not stored as a member). */
export type TreeRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** A member as seen by a manager (via the get_tree_members RPC). Keyed by email. */
export interface ManagedMember {
  email: string;
  role: MemberRole;
  status: MemberStatus;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface TreeMember {
  id: string;
  treeId: string;
  userId: string | null;
  email: string;
  role: MemberRole;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  status: MemberStatus;
}

interface MemberRow {
  id: string;
  tree_id: string;
  user_id: string | null;
  email: string;
  role: MemberRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  status: MemberStatus;
}

export function mapRow(r: MemberRow): TreeMember {
  return {
    id: r.id, treeId: r.tree_id, userId: r.user_id, email: r.email, role: r.role,
    invitedBy: r.invited_by, invitedAt: r.invited_at, acceptedAt: r.accepted_at, status: r.status,
  };
}

export const sharingEnabled = (): boolean => !!supabase;

/** Members of a tree (owner view). [] when offline or table absent. */
export async function fetchMembers(treeId: string): Promise<TreeMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tree_members')
    .select('*')
    .eq('tree_id', treeId)
    .order('invited_at', { ascending: true });
  if (error || !data) return [];
  return (data as MemberRow[]).map(mapRow);
}

/** Résultat d'une invitation : le membre créé + son token (pour l'email d'invitation). */
export interface InviteResult { member: TreeMember; token: string }

/** Invite (or re-invite) by email. Returns the member or null.
 *  Optional inviterName + treeName trigger an invitation email via /api/send-invite-email.
 *
 *  Phase 1 — DERRIÈRE LE DATASTORE (comme collaboration.ts) : cœur `*Direct(client)`
 *  (navigateur mode 'direct' + route serveur) + `*ViaApi()` (navigateur mode 'api').
 *  L'email d'invitation (effet de bord) reste dans ce wrapper navigateur. `invitedBy`
 *  n'est PAS envoyé en mode api — le serveur le dérive de la session. */
export async function inviteMember(
  treeId: string,
  email: string,
  role: MemberRole,
  invitedBy: string,
  inviterName?: string,
  treeName?: string,
): Promise<TreeMember | null> {
  if (!supabase) return null;
  const clean = email.trim().toLowerCase();
  if (!clean) return null;

  const result = getDataLayer() === 'api'
    ? await inviteMemberViaApi(treeId, clean, role)
    : await inviteMemberDirect({ treeId, email: clean, role, invitedBy }, supabase);
  if (!result) return null;

  // Send invitation email — fire-and-forget, never blocks the invitation itself.
  if (inviterName && treeName) {
    fetch('/api/send-invite-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clean, inviterName, treeName, token: result.token }),
    }).catch((err: unknown) => {
      console.warn('[sharing] Échec envoi email invitation:', err);
    });
  }

  return result.member;
}

/** Cœur direct (navigateur mode 'direct' + routes serveur avec client appelant).
 *  Génère token + expiration ; upsert sur (tree_id, email). AuthZ = RLS/route. */
export async function inviteMemberDirect(
  input: { treeId: string; email: string; role: MemberRole; invitedBy: string | null },
  client: typeof supabase = supabase,
): Promise<InviteResult | null> {
  if (!client) return null;
  const clean = input.email.trim().toLowerCase();
  if (!clean) return null;
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('tree_members')
    .upsert(
      { tree_id: input.treeId, email: clean, role: input.role, invited_by: input.invitedBy, status: 'pending', token, expires_at: expiresAt },
      { onConflict: 'tree_id,email' },
    )
    .select('*')
    .single();
  if (error || !data) return null;
  return { member: mapRow(data as MemberRow), token: (data as MemberRow & { token?: string }).token ?? token };
}

/** Chemin API : POST /api/data/collaboration/members. `invitedBy` dérivé de la session. */
async function inviteMemberViaApi(treeId: string, email: string, role: MemberRole): Promise<InviteResult | null> {
  try {
    const res = await fetch('/api/data/collaboration/members', {
      method: 'POST', credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ treeId, email, role }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { invite?: InviteResult | null };
    return j.invite ?? null;
  } catch { return null; }
}

/** Members of a tree, manager view (owner OR accepted admin). Via SECURITY DEFINER RPC. */
export async function getTreeMembers(treeId: string): Promise<ManagedMember[]> {
  if (!supabase) return [];
  const { data, error } = await callRpc('get_tree_members', { p_tree_id: treeId });
  if (error || !data) return [];
  return (data as Array<{ email: string; role: MemberRole; status: MemberStatus; invited_at: string; accepted_at: string | null }>)
    .map(r => ({ email: r.email, role: r.role, status: r.status, invitedAt: r.invited_at, acceptedAt: r.accepted_at }));
}

/** Change a member's role (owner/admin only — enforced server-side). */
export async function updateMemberRole(treeId: string, email: string, role: MemberRole): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await callRpc('update_member_role', { p_tree_id: treeId, p_email: email, p_role: role });
  return !error;
}

/** Remove a member (owner/admin only — enforced server-side). */
export async function removeMember(treeId: string, email: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await callRpc('remove_member', { p_tree_id: treeId, p_email: email });
  return !error;
}

/** Effective role of the current user on a tree, or null if no access. Via RPC. */
export async function fetchMyRole(treeId: string): Promise<TreeRole | null> {
  if (!supabase) return null;
  const { data, error } = await callRpc('my_tree_role', { p_tree_id: treeId });
  if (error) return null;
  return (data as TreeRole | null) ?? null;
}

export interface InvitationInfo {
  treeName: string;
  role: MemberRole;
  status: MemberStatus;
  invitedEmail: string;
  inviterName: string | null;
  expiresAt: string | null;
}

/** Read an invitation by token (works logged-out). Via SECURITY DEFINER RPC. */
export async function getInvitation(token: string): Promise<InvitationInfo | null> {
  if (!supabase) return null;
  const { data, error } = await callRpc('get_invitation', { p_token: token });
  if (error || !data || !(data as unknown[])[0]) return null;
  const r = (data as Array<{ tree_name: string; role: MemberRole; status: MemberStatus; invited_email: string; inviter_name: string | null; expires_at: string | null }>)[0];
  return { treeName: r.tree_name, role: r.role, status: r.status, invitedEmail: r.invited_email, inviterName: r.inviter_name, expiresAt: r.expires_at };
}

/** localStorage key holding a pending invite token to auto-accept after sign-in. */
export const PENDING_INVITE_KEY = 'suimini_pending_invite';

/** Accept an invitation by token. Returns the joined tree (or null). Via SECURITY DEFINER RPC. */
export async function acceptInvitation(token: string): Promise<{ treeId: string; treeName: string; role: MemberRole } | null> {
  if (!supabase) return null;
  const { data, error } = await callRpc('accept_invitation', { p_token: token });
  if (error || !data || !(data as unknown[])[0]) return null;
  const row = (data as Array<{ tree_id: string; tree_name: string; role: MemberRole }>)[0];

  // Best-effort: notify the tree owner that a member just joined. Fire-and-forget —
  // a notification failure must never break the join. Covers both accept paths (the
  // explicit button AND the post-sign-in auto-accept) since both funnel through here.
  // Two independent channels: email (Resend) + push (Expo), each no-op gracefully.
  fetch('/api/send-approval-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treeId: row.tree_id }),
  }).catch((err: unknown) => {
    console.warn('[sharing] Échec notification email propriétaire:', err);
  });
  fetch('/api/push/notify-join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treeId: row.tree_id }),
  }).catch((err: unknown) => {
    console.warn('[sharing] Échec notification push propriétaire:', err);
  });

  return { treeId: row.tree_id, treeName: row.tree_name, role: row.role };
}

/** Accepted memberships of the current user (the trees shared WITH me). */
/**
 * Gate d'ACTIVATION (défaut OFF) du routage des memberships vers `/api/data`
 * (→ Railway en backend `railway`, COHÉRENT avec l'écriture inviteMember/accept).
 *
 * Tant que `NEXT_PUBLIC_MEMBERSHIPS_VIA_API` n'est pas = '1', `fetchMyMemberships`
 * garde EXACTEMENT son comportement historique (lecture directe Supabase) → ZÉRO
 * changement pour le cutover owner-only actuel. **Activation = poser
 * `NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1` (Vercel) + redéployer** — à faire au moment
 * d'élargir le rollout (résout le caveat cross-backend, cf. docs/railway-migration.md
 * §5.3). Volontairement isolé ici (ne touche PAS la machinerie DATA_LAYER en prod).
 */
function membershipsViaApi(): boolean {
  return process.env.NEXT_PUBLIC_MEMBERSHIPS_VIA_API === '1';
}

/** Mes appartenances acceptées. Défaut : lecture directe Supabase (inchangé). En mode
 * `api` + flag activé : via `/api/data` → store (Railway si `DB_BACKEND=railway`). Fail-open. */
export async function fetchMyMemberships(): Promise<TreeMember[]> {
  if (!supabase) return [];
  if (getDataLayer() === 'api' && membershipsViaApi()) return fetchMyMembershipsViaApi();
  return fetchMyMembershipsDirect(supabase);
}

/** Cœur direct (navigateur mode 'direct' — comportement historique ; l'uid vient de la session). */
export async function fetchMyMembershipsDirect(client: typeof supabase = supabase): Promise<TreeMember[]> {
  if (!client) return [];
  const { data: auth } = await client.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await client
    .from('tree_members').select('*').eq('user_id', uid).eq('status', 'accepted');
  if (error || !data) return [];
  return (data as MemberRow[]).map(mapRow);
}

/** Chemin API (activé seulement si le flag est posé). Fail-open. */
async function fetchMyMembershipsViaApi(): Promise<TreeMember[]> {
  try {
    const res = await fetch('/api/data/collaboration/my-memberships', {
      credentials: 'same-origin', headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { memberships?: TreeMember[] };
    return j.memberships ?? [];
  } catch { return []; }
}
