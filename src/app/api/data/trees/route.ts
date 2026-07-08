import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { loadTreesFromSupabase } from '@/lib/supabaseSync';

// Phase 0 — GET /api/data/trees : charge les arbres accessibles de l'appelant
// (owner + partagés). L'AuthZ « je ne vois que mes arbres » est portée par la
// requête sous l'identité de l'appelant (RLS en filet) ; le filtrage par-arbre
// est intrinsèque à loadTreesFromSupabase.
export const runtime = 'nodejs';

export async function GET() {
  const { client, caller } = await getServerAuth();
  if (!client) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const result = await loadTreesFromSupabase(caller.userId, client);
  return NextResponse.json(result);
}
