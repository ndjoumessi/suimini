import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/apiData';

// POST /api/data/trees/[id]/restore  { entityType, entity } → ré-upsert vivant
// (résolution de conflit « Restaurer »). AuthZ : canWriteTreeContent.
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'write');
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const entityType = body?.entityType;
  const entity = body?.entity;
  if ((entityType !== 'person' && entityType !== 'relationship') || !entity?.id) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  try {
    await guard.store.restoreEntity(id, entityType, entity);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/data/trees/restore] failed', e);
    return NextResponse.json({ error: 'Échec de restauration.' }, { status: 500 });
  }
}
