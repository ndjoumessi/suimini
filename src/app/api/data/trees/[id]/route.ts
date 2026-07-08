import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { createSupabaseAuthzProvider, canReadTreeAsMember } from '@/lib/authz';
import { loadOneTree } from '@/lib/supabaseSync';

// Phase 0 — GET /api/data/trees/[id] : un arbre (non masqué) pour un appelant
// AYANT UNE RELATION avec lui (owner | tree_shares | membre accepté). Le public
// passe par l'endpoint masqué dédié, jamais par ici.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const authz = createSupabaseAuthzProvider(client);
  if (!(await canReadTreeAsMember(authz, id, caller))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const tree = await loadOneTree(id, client);
  if (!tree) return NextResponse.json({ error: 'Arbre introuvable.' }, { status: 404 });
  return NextResponse.json(tree);
}
