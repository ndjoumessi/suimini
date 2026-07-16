import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { isTreeOwner } from '@/lib/authz';
import { getDataStore } from '@/lib/dataStore';
import { checkOrigin } from '@/lib/apiData';

// Phase 0/1 — POST { id, status } → { ok }. Accepte/rejette une suggestion.
// La suggestion ne porte pas de treeId dans le corps : on lit son tree_id via le
// store (backend effectif), puis on vérifie explicitement la propriété (isTreeOwner)
// avant l'UPDATE.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const status = body?.status;
  if (typeof id !== 'string' || (status !== 'accepted' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const store = await getDataStore(client, caller);
  const treeId = await store.getSuggestionTreeId(id);
  if (!treeId) return NextResponse.json({ error: 'Suggestion introuvable.' }, { status: 404 });
  if (!(await isTreeOwner(store.authz, treeId, caller))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const ok = await store.resolveSuggestion(id, status);
  return NextResponse.json({ ok });
}
