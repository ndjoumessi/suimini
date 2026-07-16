/**
 * Railway PostgreSQL — pool de connexions (server-only).
 *
 * Utilisé UNIQUEMENT par le backend `RailwayStore` (voir dataStore.ts), sélectionné
 * par `DB_BACKEND=railway`. Le navigateur ne touche jamais ce module (pas de
 * `NEXT_PUBLIC_*` : la chaîne de connexion est un secret serveur).
 *
 * ⚠️ Rôle privilégié UNIQUE (pas de RLS sur Railway) : toute l'AutoriZation est
 * portée par la couche applicative (src/lib/authz.ts + RailwayStore). Ne JAMAIS
 * exposer ce pool à un chemin non gardé.
 */
import tls from 'node:tls';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// timestamptz (OID 1184) → chaîne ISO-8601, comme PostgREST/Supabase (node-pg
// renverrait un objet Date). Les mappers `rowTo*` de supabaseSync attendent des
// chaînes (createdAt/updatedAt/deleted_at) ; on garde donc le MÊME contrat de type
// quel que soit le backend. (jsonb est déjà parsé en objet JS par node-pg.)
types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));

let pool: Pool | null = null;

/** Chaîne de connexion Railway. `RAILWAY_DATABASE_URL` (préféré) ou `DATABASE_URL`. */
function connectionString(): string | null {
  return process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || null;
}

/** True si un backend Railway est configurable (chaîne présente). */
export function railwayConfigured(): boolean {
  return !!connectionString();
}

/**
 * Politique TLS. Par DÉFAUT on VÉRIFIE le certificat (posture sûre).
 *
 * Railway Postgres présente un certificat AUTO-SIGNÉ sur son proxy public
 * (`*.proxy.rlwy.net`) → la vérification de chaîne échoue. Deux sorties propres :
 *   • PROD : connecter l'app depuis le réseau PRIVÉ Railway (`*.railway.internal`,
 *     le trafic ne quitte pas le VPC) OU épingler le CA Railway via
 *     `RAILWAY_DB_CA_CERT` (PEM). ← à faire AVANT le cutover prod.
 *   • STAGING / canary : poser `RAILWAY_DB_INSECURE_SSL=1` pour accepter le
 *     cert auto-signé (chiffré mais non authentifié — acceptable hors prod, à
 *     durcir avant la bascule). Choix CONSCIENT, jamais le défaut.
 */
type SslOption = false | { ca: string; checkServerIdentity: (h: string, c: tls.PeerCertificate) => Error | undefined } | { rejectUnauthorized: boolean };
function sslConfig(): SslOption {
  const ca = process.env.RAILWAY_DB_CA_CERT;
  if (ca) {
    // Railway émet, via son proxy, un cert dont l'identité est `localhost` (≠ le
    // hostname *.proxy.rlwy.net) → la vérif de nom d'hôte par défaut échouerait
    // toujours. On NE désactive PAS la vérification d'identité : on la fait contre
    // l'identité ATTENDUE du cert Railway (`localhost` par défaut, surchargeable),
    // avec la logique SAN/CN éprouvée de node. Un cert qui n'identifie pas
    // légitimement cette valeur est REJETÉ. Couplé au CA épinglé (chaîne signée par
    // le root-ca Railway), un MITM devrait détenir la clé du CA ET émettre un cert
    // pour cette identité — bien plus fort que rejectUnauthorized:false (tout passe).
    const expected = process.env.RAILWAY_DB_TLS_SERVERNAME || 'localhost';
    return { ca, checkServerIdentity: (_host, cert) => tls.checkServerIdentity(expected, cert) };
  }
  if (process.env.RAILWAY_DB_INSECURE_SSL === '1') {
    return { rejectUnauthorized: false };                  // opt-in explicite (staging, non authentifié)
  }
  return { rejectUnauthorized: true };                     // défaut sûr
}

/** Pool paresseux, mémoïsé. Lève si la chaîne est absente (appelé seulement en mode railway). */
export function getPool(): Pool {
  if (pool) return pool;
  const cs = connectionString();
  if (!cs) throw new Error('RAILWAY_DATABASE_URL / DATABASE_URL absent — backend Railway non configuré.');
  pool = new Pool({
    connectionString: cs,
    ssl: sslConfig(),
    // Derrière PgBouncer transaction-mode : les connexions app→PgBouncer sont
    // multiplexées vers un petit nombre de connexions serveur réelles (défaut :
    // 1000 clients → 20 conns serveur / réplica). Chaque instance de fonction Vercel
    // peut donc garder un pool modéré sans risque d'épuisement de la base.
    // ⚠️ REQUIERT que RAILWAY_DATABASE_URL pointe vers l'URL POOLÉE (PgBouncer, TLS) —
    // l'URL UNPOOLED (directe) est réservée aux migrations/psql/DDL. node-pg n'utilise
    // PAS de prepared statements nommés → compatible transaction-mode.
    // Le PgBouncer Railway a le client-TLS activé (cert injecté) — voir docs/railway-migration.md.
    max: 10,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

/** Requête paramétrée simple. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

/** Transaction : `fn` reçoit un client dédié ; COMMIT/ROLLBACK automatique. */
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* connexion déjà morte */ }
    throw e;
  } finally {
    client.release();
  }
}
