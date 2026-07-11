import { NextResponse } from 'next/server';
import { guardTreeWrite, isChildTable } from '@/lib/apiData';

// POST /api/data/trees/[id]/children/delete  { table, ids } → soft-delete
// AuthZ : canWriteTreeContent. `table` whitelisté (persons|relationships|journal_entries).
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'write');
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const table = body?.table;
  const ids = body?.ids;
  if (!isChildTable(table) || !Array.isArray(ids)) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  const ok = await guard.store.deleteChildRows(id, table, ids as string[]);
  return NextResponse.json({ ok });
}
