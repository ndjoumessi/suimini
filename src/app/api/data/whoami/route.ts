import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';

// GET /api/data/whoami — sonde de diagnostic (canary). Dit à L'APPELANT si le
// serveur résout SA session (cookie ou Bearer). Ne renvoie que des infos sur
// soi-même → pas de secret, pas besoin de gate. Sert à trancher :
//   authenticated:false alors qu'on est connecté → bug de résolution de session
//   (le vrai suspect du 401 « Synchronisation impossible » sous DATA_LAYER=api).
export const runtime = 'nodejs';

export async function GET() {
  const { client, caller } = await getServerAuth();
  return NextResponse.json({
    supabaseConfigured: !!client,
    authenticated: !!caller,
    userId: caller?.userId ?? null,
    role: caller?.role ?? null,
  });
}
