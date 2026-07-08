import { NextResponse } from 'next/server';
import { guardTreeWrite, isChildTable } from '@/lib/apiData';
import { detectDeleteConflicts } from '@/lib/supabaseSync';

// POST /api/data/trees/[id]/conflicts  { table, entities } → DeleteConflict[]
// Détection delete-vs-edit avant un push. AuthZ : canWriteTreeContent.
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'write');
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const table = body?.table;
  const entities = body?.entities;
  if (!isChildTable(table) || !Array.isArray(entities)) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  const conflicts = await detectDeleteConflicts(table, entities, guard.client);
  return NextResponse.json(conflicts);
}
