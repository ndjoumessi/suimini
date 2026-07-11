import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/apiData';

// Phase 0 — suggestions d'édition.
//   GET  ?treeId[&personId]        → { suggestions } (pending, plus ancien d'abord)
//   POST { treeId, personId, field, currentValue, suggestedValue, authorName } → { suggestion }
// AuthZ : OWNER-only (mirror RLS 0012 `suggestions_tree_members`). author_id = session.
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const treeId = url.searchParams.get('treeId');
  const personId = url.searchParams.get('personId') ?? undefined;
  if (!treeId) return NextResponse.json({ error: 'treeId requis.' }, { status: 400 });

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const suggestions = await guard.store.fetchPendingSuggestions(treeId, personId);
  return NextResponse.json({ suggestions });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const treeId = body?.treeId;
  const personId = body?.personId;
  const field = body?.field;
  const suggestedValue = body?.suggestedValue;
  const currentValue = typeof body?.currentValue === 'string' ? body.currentValue : null;
  const authorName = typeof body?.authorName === 'string' ? body.authorName : '';
  if (typeof treeId !== 'string' || typeof personId !== 'string' || typeof field !== 'string' || typeof suggestedValue !== 'string') {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const suggestion = await guard.store.addSuggestion(
    { treeId, personId, field, currentValue, suggestedValue, author: { id: guard.caller.userId, name: authorName } },
  );
  return NextResponse.json({ suggestion });
}
