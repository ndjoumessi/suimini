import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/data/apiData';

// Phase 0 — commentaires de personne.
//   GET  ?treeId&personId          → { comments }
//   POST { treeId, personId, content, authorName } → { comment }
// AuthZ : OWNER-only (mirror exact du RLS 0012 `comments_tree_members`). L'author_id
// est dérivé de la SESSION (caller.userId), jamais du corps → pas d'usurpation.
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const treeId = url.searchParams.get('treeId');
  const personId = url.searchParams.get('personId');
  if (!treeId || !personId) return NextResponse.json({ error: 'treeId et personId requis.' }, { status: 400 });

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const comments = await guard.store.fetchComments(treeId, personId);
  return NextResponse.json({ comments });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const treeId = body?.treeId;
  const personId = body?.personId;
  const content = body?.content;
  const authorName = typeof body?.authorName === 'string' ? body.authorName : '';
  if (typeof treeId !== 'string' || typeof personId !== 'string' || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const guard = await guardTreeWrite(treeId, 'owner');
  if (!guard.ok) return guard.res;

  const comment = await guard.store.addComment(
    treeId, personId, content, { id: guard.caller.userId, name: authorName },
  );
  return NextResponse.json({ comment });
}
