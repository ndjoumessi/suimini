import { NextResponse } from 'next/server';
import { guardTreeWrite } from '@/lib/apiData';

// POST /api/data/trees/[id]/save  { tree, isOwner? } → saveTreeToSupabase
// AuthZ : canWriteTreeContent (owner | tree_shares=write). `isOwner` est
// RECALCULÉ côté serveur (jamais celui du client) → un partenaire write ne peut
// pas réécrire la ligne trees (owner only).
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'write');
  if (!guard.ok) return guard.res;
  const { caller, store } = guard;

  const body = await req.json().catch(() => null);
  const tree = body?.tree;
  if (!tree || tree.id !== id) return NextResponse.json({ error: 'Corps invalide (tree.id ≠ [id]).' }, { status: 400 });

  const owner = await store.authz.getTreeOwnerId(id);
  const isOwner = owner === caller.userId; // autorité serveur, pas le flag client

  try {
    await store.saveTree(tree, caller.userId, isOwner);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Message générique au client (une erreur pg peut exposer schéma/contraintes) ;
    // détail en logs serveur seulement.
    console.error('[api/data/trees/save] failed', e);
    return NextResponse.json({ error: 'Échec de sauvegarde.' }, { status: 500 });
  }
}
