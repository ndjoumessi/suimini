/**
 * Configuration du relais, lue depuis l'environnement. Aucune valeur secrète
 * n'est jamais renvoyée à un client — le relais ne diffuse que { t, tbl, op }.
 */
import tls from 'node:tls';

export interface RelayConfig {
  port: number;
  /** URL Postgres Railway DIRECTE (unpooled) — LISTEN/NOTIFY ne passe PAS PgBouncer. */
  databaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Origines autorisées (CORS/Origin du handshake WS). Vide = tout accepter. */
  allowedOrigins: string[];
  /** Debounce de coalescence par arbre (ms) : une rafale d'UPSERT → un seul signal. */
  coalesceMs: number;
  ssl: SslOption;
}

type SslOption = false | { ca: string; checkServerIdentity: (h: string, c: tls.PeerCertificate) => Error | undefined } | { rejectUnauthorized: boolean };

/**
 * Politique TLS — MIROIR EXACT de src/lib/railwayDb.ts (posture sûre par défaut).
 *   • `RAILWAY_DB_CA_CERT` (PEM) → CA épinglé + identité vérifiée (`RAILWAY_DB_TLS_SERVERNAME`, défaut 'localhost').
 *   • `RAILWAY_DB_INSECURE_SSL=1` → accepte le cert auto-signé (chiffré, non authentifié — staging seulement).
 *   • sinon → vérification stricte (rejectUnauthorized: true).
 * En prod, préférer le réseau PRIVÉ Railway (*.railway.internal) : le trafic ne
 * quitte pas le VPC, la vérif de chaîne est alors satisfaite nativement.
 */
function sslConfig(): SslOption {
  const ca = process.env.RAILWAY_DB_CA_CERT;
  if (ca) {
    const expected = process.env.RAILWAY_DB_TLS_SERVERNAME || 'localhost';
    return { ca, checkServerIdentity: (_host, cert) => tls.checkServerIdentity(expected, cert) };
  }
  if (process.env.RAILWAY_DB_INSECURE_SSL === '1') {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

export function loadConfig(): RelayConfig {
  const databaseUrl =
    process.env.RELAY_DATABASE_URL ||
    process.env.RAILWAY_DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    '';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!databaseUrl) throw new Error('RELAY_DATABASE_URL absent (URL Postgres Railway DIRECTE / unpooled requise).');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY absents (validation des jetons).');

  return {
    port: Number(process.env.PORT || 8787),
    databaseUrl,
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    supabaseAnonKey,
    allowedOrigins: (process.env.RELAY_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    coalesceMs: Number(process.env.RELAY_COALESCE_MS || 250),
    ssl: sslConfig(),
  };
}
