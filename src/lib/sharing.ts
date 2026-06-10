// Multi-member tree sharing (tree_members). All functions degrade to safe
// no-ops when Supabase isn't configured OR the table hasn't been applied yet
// (errors are swallowed so the single-owner app keeps working).
import { supabase } from './supabase';

export type MemberRole = 'viewer' | 'editor' | 'admin';
export type MemberStatus = 'pending' | 'accepted' | 'declined';

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

export async function updateMemberRole(id: string, role: MemberRole): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('tree_members').update({ role }).eq('id', id);
  return !error;
}

export async function removeMember(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('tree_members').delete().eq('id', id);
  return !error;
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
