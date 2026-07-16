import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/data/apiData';

// Phase 1 — F1 fix : lien public en lecture seule (trees.is_public/public_slug),
// owner-only (métadonnée d'arbre, même tier que shareTree/deleteTree — jamais
// un simple collaborateur write). GET l'état courant, POST bascule.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;
  const share = await guard.store.getPublicShare(id);
  return NextResponse.json(share);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const isPublic = body?.isPublic;
  const slug = body?.slug;
  if (typeof isPublic !== 'boolean' || (slug !== undefined && slug !== null && typeof slug !== 'string')) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;

  const result = await guard.store.setTreePublic(id, isPublic, slug ?? null);
  return NextResponse.json(result);
}
