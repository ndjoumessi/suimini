import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/data/apiData';

// Phase 1 — F1 fix : partage par email (tree_shares), owner-only. Miroir de
// `collaboration/members/route.ts` (même guard, même forme). GET liste, POST
// upsert (share/re-share), DELETE retire (email en query param).
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;
  const shares = await guard.store.listShares(id);
  return NextResponse.json({ shares });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const permission = body?.permission;
  if (typeof email !== 'string' || !email.trim() || (permission !== 'read' && permission !== 'write')) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;

  const result = await guard.store.shareTree(id, email, permission);
  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email requis.' }, { status: 400 });

  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;

  await guard.store.unshareTree(id, email);
  return NextResponse.json({});
}
