import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { getDataStore } from '@/lib/dataStore';
import { stripUnauthorizedJournal } from '@/lib/authz';

// Phase 0/1 — GET /api/data/trees : charge les arbres accessibles de l'appelant
// (owner + partagés). Le backend (Supabase RLS ou Railway authz-explicite) est
// résolu par getDataStore ; le filtrage par-arbre est intrinsèque à loadTrees.
export const runtime = 'nodejs';

export async function GET() {
  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const store = await getDataStore(client, caller);
  const result = await store.loadTrees(caller);
  // Sécu F1 : loadTrees renvoie aussi les arbres où l'appelant n'est qu'un
  // membre accepté (canReadTreeAsMember) — le journal, lui, reste owner/
  // tree_shares SEULEMENT (canReadJournal). Pas de RLS sur Railway pour le
  // filtrer en amont : c'est la seule ligne de défense sur ce backend.
  await stripUnauthorizedJournal(store.authz, result.trees, caller);
  return NextResponse.json(result);
}
