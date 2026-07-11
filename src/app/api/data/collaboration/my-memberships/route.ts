import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { getDataStore } from '@/lib/dataStore';

// Phase 1 (PRÊT MAIS INACTIF par défaut) — GET → { memberships }.
// « Quels arbres partagés AVEC moi » (tree_members acceptés du caller). Utilisé
// UNIQUEMENT quand le navigateur route via api (getDataLayer='api') ET que le flag
// NEXT_PUBLIC_MEMBERSHIPS_VIA_API=1 est posé (cf. sharing.ts fetchMyMemberships).
// Le backend suit DB_BACKEND (RailwayStore en mode railway). Fail-open : jamais
// d'erreur bloquante → [] (contrat historique de fetchMyMemberships).
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { client, caller } = await getServerAuth();
    if (!client || !caller) return NextResponse.json({ memberships: [] });
    const store = await getDataStore(client, caller);
    const memberships = await store.getMyMemberships(caller.userId);
    return NextResponse.json({ memberships });
  } catch {
    return NextResponse.json({ memberships: [] }); // fail-open
  }
}
