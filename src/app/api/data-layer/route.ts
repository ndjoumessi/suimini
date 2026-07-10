import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { getDataLayerRule, resolveLayer } from '@/lib/dataLayerConfig';

/**
 * GET /api/data-layer → { layer: 'api' | 'direct' } pour l'appelant.
 *
 * Sert le DÉFAUT SERVEUR RUNTIME au navigateur (résolu au boot par `dataClient`).
 * Sous `/api/` → NETWORK-ONLY (le SW ne le met jamais en cache) → flip ET rollback
 * instantanés pour toute nouvelle session/navigation, sans redéploiement.
 *
 * ⚠️ Appelant ANONYME → toujours 'direct' : tout /api/data/* exige une session
 * (401 sinon), et le chemin invitation `get_invitation` pré-login DOIT rester direct.
 * Seuls les utilisateurs authentifiés sont éligibles à l'`api` (allowlist / %).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { caller } = await getServerAuth();
  if (!caller) return NextResponse.json({ layer: 'direct' });
  const rule = await getDataLayerRule();
  return NextResponse.json({ layer: resolveLayer(rule, caller.userId) });
}
