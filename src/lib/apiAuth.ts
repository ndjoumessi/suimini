/**
 * Phase 0 — AuthN serveur pour les endpoints /api/data/*.
 *
 * Lit la session Supabase depuis les cookies (le navigateur les envoie en
 * same-origin) → renvoie l'appelant (userId, email, role) ET un client Supabase
 * lié à cette session. Les requêtes de l'endpoint tournent donc SOUS L'IDENTITÉ
 * de l'appelant → RLS reste le filet pendant la Phase 0.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Caller, Role } from '@/lib/authz';

export interface ServerAuth {
  /** Client Supabase lié à la session (null si Supabase non configuré). */
  client: any | null;
  /** Appelant authentifié, ou null (non authentifié / lien public). */
  caller: Caller | null;
}

export async function getServerAuth(): Promise<ServerAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { client: null, caller: null };

  const cookieStore = await cookies();
  const client = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only context */ } },
  });

  const { data: { user } } = await client.auth.getUser();
  if (!user) return { client, caller: null };

  // Rôle depuis le profil (lecture de soi autorisée par RLS). Défaut 'user'.
  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = ((profile as { role?: Role } | null)?.role ?? 'user') as Role;

  return { client, caller: { userId: user.id, email: user.email ?? '', role } };
}
