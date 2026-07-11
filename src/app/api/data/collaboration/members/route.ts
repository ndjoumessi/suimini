import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/apiData';

// Phase 1 — POST { treeId, email, role } → { invite: { member, token } }.
// Invite (ou ré-invite) un membre par email (upsert tree_members). AuthZ : OWNER
// (miroir du RLS d'insertion tree_members). `invitedBy` est dérivé de la SESSION
// (caller.userId), jamais du corps → pas d'usurpation. Le token/expiration sont
// générés par le store ; le navigateur les récupère pour l'email d'invitation.
export const runtime = 'nodejs';

const ROLES = ['viewer', 'editor', 'admin'];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const treeId = body?.treeId;
  const email = body?.email;
  const role = body?.role;
  if (typeof treeId !== 'string' || typeof email !== 'string' || typeof role !== 'string' || !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const invite = await guard.store.inviteMember(treeId, email, role as 'viewer' | 'editor' | 'admin', guard.caller.userId);
  return NextResponse.json({ invite });
}
