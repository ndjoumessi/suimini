import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkOrigin } from '@/lib/data/apiData';

// Server route; runs on Node.
export const runtime = 'nodejs';

/**
 * POST /api/push/register  { token, platform?, provider? }
 *
 * Enregistre l'Expo Push Token d'un appareil mobile pour l'utilisateur connecté.
 * Authentification par **Bearer JWT** (l'app mobile envoie `Authorization:
 * Bearer <access_token Supabase>` — voir mobile/lib/notifications.ts).
 *
 * Le client Supabase est créé AVEC ce JWT dans les en-têtes : `auth.getUser()`
 * le valide et l'upsert s'exécute sous l'identité de l'appelant, donc la RLS de
 * `push_tokens` (user_id = auth.uid()) s'applique nativement.
 *
 * Table : supabase/push-tokens.sql (migration manuelle).
 * No-op gracieux (500) si Supabase n'est pas configuré.
 */
export async function POST(req: Request) {
  // Sécu F7 : sans effet pour l'app mobile (Bearer, pas d'en-tête Origin envoyé
  // par un fetch natif) — défense en profondeur pour un éventuel appel web.
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  }

  // --- AuthN via Bearer JWT ---
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return NextResponse.json({ error: 'Token d’authentification manquant.' }, { status: 401 });
  }

  // Client porteur du JWT de l'appelant → RLS appliquée à l'upsert.
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // --- Payload ---
  let body: { token?: string; platform?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token manquant.' }, { status: 400 });
  }
  const platform = body.platform?.trim() || null;
  const provider = body.provider?.trim() || 'expo';

  // --- Upsert (clé unique = token ; ré-enregistrement = mise à jour) ---
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) {
    // ex. table absente (migration non appliquée) ou conflit RLS.
    return NextResponse.json({ error: 'Enregistrement échoué.', detail: error.message }, { status: 502 });
  }

  return NextResponse.json({ registered: true });
}
