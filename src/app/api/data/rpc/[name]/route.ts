import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';

// POST /api/data/rpc/[name] { args } → forward supabase.rpc(name, args) sous
// l'identité de l'appelant. Les RPC sont SECURITY DEFINER (AuthZ interne : rôle
// admin, appartenance à l'arbre…) → ce forward n'accorde rien de plus. `name`
// whitelisté pour ne pas exposer une RPC arbitraire.
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
  const { data, error } = await client.rpc(name, args);
  return NextResponse.json({ data: data ?? null, error: error ? { message: error.message } : null });
}
