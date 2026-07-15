/**
 * AuthN + AuthZ du handshake WebSocket.
 *
 * AuthN : le jeton (access_token Supabase, même JWT que `getServerAuth` côté web)
 *   est validé en interrogeant `${SUPABASE_URL}/auth/v1/user` (source autoritaire,
 *   identique à `client.auth.getUser()` de apiAuth.ts). Pas de vérif de signature
 *   locale → aucun secret JWT à détenir côté relais.
 *
 * AuthZ : MIROIR EXACT de `canReadTreeAsMember` (src/lib/authz.ts) — owner OU
 *   tree_shares(read|write) par email OU membre ACCEPTÉ. Le public (lien partagé
 *   anonyme) n'est PAS relayé : le temps réel exige une identité. Un arbre non
 *   autorisé → handshake refusé (pas de fuite inter-arbres, comme le `filter:
 *   tree_id=eq.…` du canal Supabase historique).
 */
import type { Pool } from 'pg';
import type { RelayConfig } from './config';

export interface AuthedUser {
  userId: string;
  email: string;
}

/** Valide le jeton via Supabase GoTrue. `null` si invalide/expiré. */
export async function verifyToken(cfg: RelayConfig, token: string): Promise<AuthedUser | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return null;
    return { userId: user.id, email: user.email ?? '' };
  } catch {
    return null;
  }
}

/**
 * L'utilisateur peut-il LIRE cet arbre ? Miroir de canReadTreeAsMember :
 * owner OU tree_shares(read|write) par email OU membre accepté. Une seule requête
 * combinée (EXISTS) sous le rôle privilégié du relais (pas de RLS sur Railway).
 */
export async function canReadTree(pool: Pool, treeId: string, user: AuthedUser): Promise<boolean> {
  const { rows } = await pool.query<{ allowed: boolean }>(
    `select (
        exists(select 1 from trees where id = $1 and owner_id = $2)
        or exists(select 1 from tree_members where tree_id = $1 and user_id = $2 and status = 'accepted')
        or exists(select 1 from tree_shares where tree_id = $1 and shared_with_email = $3)
      ) as allowed`,
    [treeId, user.userId, user.email],
  );
  return rows[0]?.allowed === true;
}
