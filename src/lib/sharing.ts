// Multi-member tree sharing (tree_members). All functions degrade to safe
// no-ops when Supabase isn't configured OR the table hasn't been applied yet
// (errors are swallowed so the single-owner app keeps working).
import { supabase } from './supabase';
import { callRpc, rpcViaApi } from '@/lib/rpcClient';
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
  // Sécu F5 : treeId est envoyé pour que la route revérifie côté serveur que
  // l'appelant est bien PROPRIÉTAIRE de cet arbre (guardTreeWrite 'owner') —
  // avant, la route faisait confiance à inviterName/treeName sans lien vérifié
  // vers un arbre réel.
  if (inviterName && treeName) {
    fetch('/api/send-invite-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treeId, email: clean, inviterName, treeName, token: result.token }),
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

// ── Partage par email (tree_shares) + lien public (F1 fix) ───────────────────
// F1 : ShareModal.tsx importait ces 5 fonctions DIRECTEMENT depuis supabaseSync.ts
// (Supabase-direct, sans passer par getDataLayer()/DataStore) — cassé en silence
// depuis le cutover Railway (nouveaux partages/liens publics jamais lus par
// l'AuthZ, qui lit désormais Railway). Même patron *Direct/*ViaApi qu'inviteMember
// ci-dessus : ShareModal importe maintenant ces wrappers d'ICI, plus de
// supabaseSync directement.
import {
  shareTree as shareTreeDirect, listShares as listSharesDirect, unshareTree as unshareTreeDirect,
  getPublicShare as getPublicShareDirect, setTreePublic as setTreePublicDirect,
} from './supabaseSync';

export async function shareTree(treeId: string, email: string, permission: 'read' | 'write'): Promise<{ error?: string }> {
  if (getDataLayer() === 'api') return shareTreeViaApi(treeId, email, permission);
  return shareTreeDirect(treeId, email, permission, supabase);
}
async function shareTreeViaApi(treeId: string, email: string, permission: 'read' | 'write'): Promise<{ error?: string }> {
  try {
    const res = await fetch(`/api/data/trees/${treeId}/share`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, permission }),
    });
    const json = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) return { error: json.error || `API ${res.status}` };
    return json;
  } catch (e) { return { error: e instanceof Error ? e.message : 'Erreur réseau.' }; }
}

export async function listShares(treeId: string): Promise<{ email: string; permission: string }[]> {
  if (getDataLayer() === 'api') return listSharesViaApi(treeId);
  return listSharesDirect(treeId, supabase);
}
async function listSharesViaApi(treeId: string): Promise<{ email: string; permission: string }[]> {
  try {
    const res = await fetch(`/api/data/trees/${treeId}/share`, { credentials: 'same-origin' });
    if (!res.ok) return [];
    const json = (await res.json()) as { shares?: { email: string; permission: string }[] };
    return json.shares ?? [];
  } catch { return []; }
}

export async function unshareTree(treeId: string, email: string): Promise<void> {
  if (getDataLayer() === 'api') { await unshareTreeViaApi(treeId, email); return; }
  return unshareTreeDirect(treeId, email, supabase);
}
async function unshareTreeViaApi(treeId: string, email: string): Promise<void> {
  try {
    await fetch(`/api/data/trees/${treeId}/share?email=${encodeURIComponent(email)}`, {
      method: 'DELETE', credentials: 'same-origin',
    });
  } catch { /* best-effort, la liste sera re-fetchée par l'appelant */ }
}

export async function getPublicShare(treeId: string): Promise<{ isPublic: boolean; slug: string | null }> {
  if (getDataLayer() === 'api') return getPublicShareViaApi(treeId);
  return getPublicShareDirect(treeId, supabase);
}
async function getPublicShareViaApi(treeId: string): Promise<{ isPublic: boolean; slug: string | null }> {
  try {
    const res = await fetch(`/api/data/trees/${treeId}/public`, { credentials: 'same-origin' });
    if (!res.ok) return { isPublic: false, slug: null };
    return (await res.json()) as { isPublic: boolean; slug: string | null };
  } catch { return { isPublic: false, slug: null }; }
}

export async function setTreePublic(treeId: string, isPublic: boolean, slug?: string | null): Promise<{ error?: string }> {
  if (getDataLayer() === 'api') return setTreePublicViaApi(treeId, isPublic, slug);
  return setTreePublicDirect(treeId, isPublic, slug, supabase);
}
async function setTreePublicViaApi(treeId: string, isPublic: boolean, slug?: string | null): Promise<{ error?: string }> {
  try {
    const res = await fetch(`/api/data/trees/${treeId}/public`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ isPublic, slug: slug ?? null }),
    });
    const json = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) return { error: json.error || `API ${res.status}` };
    return json;
  } catch (e) { return { error: e instanceof Error ? e.message : 'Erreur réseau.' }; }
}

export interface InvitationInfo {
  treeName: string;
  role: MemberRole;
  status: MemberStatus;
  invitedEmail: string;
  inviterName: string | null;
  expiresAt: string | null;
}

/** Read an invitation by token (works logged-out). Via SECURITY DEFINER RPC.
 *
 *  F2 fix : contrairement aux autres RPC de ce fichier, celle-ci ne passe PAS
 *  par `callRpc`/`getDataLayer()` — un visiteur anonyme est toujours épinglé
 *  sur `direct` (voir `/api/data-layer`), qui pointait cette lecture sur
 *  Supabase même quand l'invitation vit sur Railway (backend `DB_BACKEND`
 *  courant). On force donc TOUJOURS le chemin `/api/data/rpc/get_invitation`,
 *  qui résout lui-même le bon backend serveur (`getDataStore`) indépendamment
 *  de la session — cette RPC est explicitement exemptée de l'auth requise sur
 *  cette route (voir commentaire `ANON_ALLOWED` dans la route). */
export async function getInvitation(token: string): Promise<InvitationInfo | null> {
  if (!supabase) return null;
  const { data, error } = await rpcViaApi('get_invitation', { p_token: token });
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
