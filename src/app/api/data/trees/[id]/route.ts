import { NextResponse } from 'next/server';
import { guardTreeRead, guardTreeWrite } from '@/lib/apiData';
import { stripUnauthorizedJournal } from '@/lib/authz';

// Phase 0/1 — GET /api/data/trees/[id] : un arbre (non masqué) pour un appelant
// AYANT UNE RELATION avec lui (owner | tree_shares | membre accepté). Le public
// passe par l'endpoint masqué dédié, jamais par ici.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeRead(id);
  if (!guard.ok) return guard.res;

  const tree = await guard.store.loadOneTree(id);
  if (!tree) return NextResponse.json({ error: 'Arbre introuvable.' }, { status: 404 });
  // Sécu F1 : canReadTreeAsMember (le guard ci-dessus) autorise aussi un simple
  // membre accepté — mais le journal, lui, est owner/tree_shares SEULEMENT.
  await stripUnauthorizedJournal(guard.store.authz, [tree], guard.caller);
  return NextResponse.json(tree);
}

// DELETE /api/data/trees/[id] : suppression d'un ARBRE entier (seul DELETE dur
// restant). AuthZ : owner uniquement.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardTreeWrite(id, 'owner');
  if (!guard.ok) return guard.res;
  const result = await guard.store.deleteTree(id, guard.caller.userId);
  return NextResponse.json(result);
}
