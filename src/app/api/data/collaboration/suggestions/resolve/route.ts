import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { createSupabaseAuthzProvider, isTreeOwner } from '@/lib/authz';
import { resolveSuggestionDirect } from '@/lib/collaboration';

// Phase 0 — POST { id, status } → { ok }. Accepte/rejette une suggestion.
// La suggestion ne porte pas de treeId dans le corps : on lit son tree_id sous
// l'identité de l'appelant (RLS owner-only ⇒ un non-propriétaire ne le voit pas),
// puis on vérifie explicitement la propriété (isTreeOwner) avant l'UPDATE.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const status = body?.status;
  if (typeof id !== 'string' || (status !== 'accepted' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const { data: sugg } = await client.from('person_suggestions').select('tree_id').eq('id', id).maybeSingle();
  if (!sugg?.tree_id) return NextResponse.json({ error: 'Suggestion introuvable.' }, { status: 404 });

  const authz = createSupabaseAuthzProvider(client);
  if (!(await isTreeOwner(authz, sugg.tree_id as string, caller))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const ok = await resolveSuggestionDirect(id, status, client);
  return NextResponse.json({ ok });
}
