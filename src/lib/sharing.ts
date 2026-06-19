// Multi-member tree sharing (tree_members). All functions degrade to safe
// no-ops when Supabase isn't configured OR the table hasn't been applied yet
// (errors are swallowed so the single-owner app keeps working).
import { supabase } from './supabase';

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

function mapRow(r: MemberRow): TreeMember {
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

/** Invite (or re-invite) by email. Returns the row or null.
 *  Optional inviterName + treeName trigger an invitation email via /api/send-invite-email. */
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

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('tree_members')
    .upsert(
      {
        tree_id: treeId,
        email: clean,
        role,
        invited_by: invitedBy,
        status: 'pending',
        token,
        expires_at: expiresAt,
      },
      { onConflict: 'tree_id,email' },
    )
    .select('*')
    .single();
  if (error || !data) return null;

  // Send invitation email — fire-and-forget, never blocks the invitation itself.
  if (inviterName && treeName) {
    const row = data as MemberRow & { token?: string };
    const emailToken = row.token ?? token;
    fetch('/api/send-invite-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clean, inviterName, treeName, token: emailToken }),
    }).catch((err: unknown) => {
      console.warn('[sharing] Échec envoi email invitation:', err);
    });
  }

  return mapRow(data as MemberRow);
}

/** Members of a tree, manager view (owner OR accepted admin). Via SECURITY DEFINER RPC. */
export async function getTreeMembers(treeId: string): Promise<ManagedMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_tree_members', { p_tree_id: treeId });
  if (error || !data) return [];
  return (data as Array<{ email: string; role: MemberRole; status: MemberStatus; invited_at: string; accepted_at: string | null }>)
    .map(r => ({ email: r.email, role: r.role, status: r.status, invitedAt: r.invited_at, acceptedAt: r.accepted_at }));
}

/** Change a member's role (owner/admin only — enforced server-side). */
export async function updateMemberRole(treeId: string, email: string, role: MemberRole): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('update_member_role', { p_tree_id: treeId, p_email: email, p_role: role });
  return !error;
}

/** Remove a member (owner/admin only — enforced server-side). */
export async function removeMember(treeId: string, email: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('remove_member', { p_tree_id: treeId, p_email: email });
  return !error;
}

/** Effective role of the current user on a tree, or null if no access. Via RPC. */
export async function fetchMyRole(treeId: string): Promise<TreeRole | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_tree_role', { p_tree_id: treeId });
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
  const { data, error } = await supabase.rpc('get_invitation', { p_token: token });
  if (error || !data || !(data as unknown[])[0]) return null;
  const r = (data as Array<{ tree_name: string; role: MemberRole; status: MemberStatus; invited_email: string; inviter_name: string | null; expires_at: string | null }>)[0];
  return { treeName: r.tree_name, role: r.role, status: r.status, invitedEmail: r.invited_email, inviterName: r.inviter_name, expiresAt: r.expires_at };
}

/** localStorage key holding a pending invite token to auto-accept after sign-in. */
export const PENDING_INVITE_KEY = 'suimini_pending_invite';

/** Accept an invitation by token. Returns the joined tree (or null). Via SECURITY DEFINER RPC. */
export async function acceptInvitation(token: string): Promise<{ treeId: string; treeName: string; role: MemberRole } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error || !data || !(data as unknown[])[0]) return null;
  const row = (data as Array<{ tree_id: string; tree_name: string; role: MemberRole }>)[0];
  return { treeId: row.tree_id, treeName: row.tree_name, role: row.role };
}

/** Accepted memberships of the current user (the trees shared WITH me). */
export async function fetchMyMemberships(): Promise<TreeMember[]> {
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('tree_members')
    .select('*')
    .eq('user_id', uid)
    .eq('status', 'accepted');
  if (error || !data) return [];
  return (data as MemberRow[]).map(mapRow);
}
