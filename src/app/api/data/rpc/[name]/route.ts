import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { getDataStore, DATA_PLANE_RPCS } from '@/lib/dataStore';

// POST /api/data/rpc/[name] { args } → forward de la RPC sous l'identité de
// l'appelant. Les RPC sont SECURITY DEFINER (AuthZ interne : rôle admin,
// appartenance à l'arbre…). `name` whitelisté. En backend Railway, les RPC
// DATA-PLANE (membres/invitations) sont servies par le store (réimplémentées en
// SQL sans auth.uid()) ; les RPC admin/profil restent TOUJOURS sur Supabase.
export const runtime = 'nodejs';

const ALLOWED = new Set([
  // Partage / collaboration
  'get_tree_members', 'update_member_role', 'remove_member', 'my_tree_role', 'get_invitation', 'accept_invitation',
  // Admin
  'list_all_users', 'get_unread_notifications', 'approve_user', 'reject_user', 'set_user_status', 'set_user_role', 'mark_all_notifications_read',
  // Compte / profils
  'delete_account', 'get_public_profiles',
]);

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return NextResponse.json({ error: 'RPC non autorisée.' }, { status: 403 });

  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const args = (body as { args?: Record<string, unknown> })?.args ?? {};

  // Railway ne connaît que les RPC data-plane ; l'admin/profil reste sur Supabase.
  const store = await getDataStore(client, caller);
  if (store.backend === 'railway' && DATA_PLANE_RPCS.has(name)) {
    const { data, error } = await store.rpc(name, args, caller);
    return NextResponse.json({ data: data ?? null, error });
  }

  const { data, error } = await client.rpc(name, args);
  return NextResponse.json({ data: data ?? null, error: error ? { message: error.message } : null });
}
