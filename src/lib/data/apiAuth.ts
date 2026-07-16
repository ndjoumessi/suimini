/**
 * Phase 0 — AuthN serveur pour les endpoints /api/data/*.
 *
 * Résout l'appelant de DEUX façons :
 *   • Cookie de session Supabase (web same-origin) — avec `setAll` RÉEL pour que
 *     le rafraîchissement de token soit persisté (une session expirée était sinon
 *     mal résolue → 401 pour un user pourtant connecté : suspect n°1 de l'échec
 *     du flip).
 *   • `Authorization: Bearer <access_token>` (mobile / API sans cookies) — le
 *     JWT est validé et le client tourne sous cette identité.
 * Dans les deux cas, les requêtes tournent SOUS L'IDENTITÉ de l'appelant → RLS
 * reste le filet pendant la Phase 0.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { Caller, Role } from '@/lib/data/authz';

export interface ServerAuth {
  client: any | null;
  caller: Caller | null;
}

export async function getServerAuth(): Promise<ServerAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { client: null, caller: null };

  const hdrs = await headers();
  const authHeader = hdrs.get('authorization') ?? '';
  const bearer = /^bearer\s+/i.test(authHeader) ? authHeader.replace(/^bearer\s+/i, '').trim() : '';

  let client: any;
  if (bearer) {
    // Client lié au JWT : pas de cookies, l'Authorization voyage sur chaque requête
    // PostgREST → RLS sous l'identité du token.
    client = createServerClient(url, key, {
      cookies: { getAll() { return []; }, setAll() { /* pas de cookies en mode Bearer */ } },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  } else {
    const cookieStore = await cookies();
    client = createServerClient(url, key, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          // Persiste les tokens rafraîchis (route handler = contexte inscriptible ;
          // try/catch pour les contextes en lecture seule éventuels).
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* read-only context */ }
        },
      },
    });
  }

  const { data: { user } } = bearer ? await client.auth.getUser(bearer) : await client.auth.getUser();
  if (!user) return { client, caller: null };

  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = ((profile as { role?: Role } | null)?.role ?? 'user') as Role;

  return { client, caller: { userId: user.id, email: user.email ?? '', role } };
}
