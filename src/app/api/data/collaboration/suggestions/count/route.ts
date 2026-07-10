import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/apiData';
import { countPendingSuggestionsDirect } from '@/lib/collaboration';

// Phase 0 — GET ?treeId → { count } (suggestions pending, pour le badge sidebar).
// AuthZ : OWNER-only (mirror RLS 0012).
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const treeId = new URL(req.url).searchParams.get('treeId');
  if (!treeId) return NextResponse.json({ error: 'treeId requis.' }, { status: 400 });

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const count = await countPendingSuggestionsDirect(treeId, guard.client);
  return NextResponse.json({ count });
}
