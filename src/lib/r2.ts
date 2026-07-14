/**
 * Cloudflare R2 (S3-compatible) — helpers SERVER-ONLY (Phase A — migration Storage).
 *
 * ⚠️ Ne JAMAIS importer ce module côté client : il lit les clés secrètes R2
 * (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) qui ne doivent JAMAIS fuiter au
 * navigateur. Seules les routes serveur `/api/storage/*` s'en servent, pour :
 *   • émettre des URLs d'upload signées (PUT) de courte durée (voir sign-upload) ;
 *   • supprimer un objet (voir delete).
 * Le domaine de LECTURE publique (`R2_PUBLIC_BASE_URL`) n'est PAS un secret et est
 * exposé au client via `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` (côté web) /
 * `EXPO_PUBLIC_R2_PUBLIC_BASE_URL` (mobile) pour construire les URLs publiques.
 *
 * Miroir du pattern data (lib/railwayDb.ts) : env server-only + échec GRACIEUX
 * (retourne `null` si non configuré → la route renvoie une erreur claire, ne crash
 * pas — comme les routes email no-op sans `RESEND_API_KEY`).
 */
import { S3Client } from '@aws-sdk/client-s3';

export interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Lit la configuration R2 depuis l'environnement (server-only). Retourne `null`
 * si l'un des secrets requis manque (compte / clé / secret) → l'appelant doit
 * répondre gracieusement (503 "storage non configuré"), jamais crasher.
 * `R2_BUCKET_NAME` a un défaut explicite `suimini-avatars` (le bucket créé par
 * le user), mais préférer le poser explicitement en env.
 */
export function readR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'suimini-avatars';
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

// Client S3 mémoïsé (l'endpoint/les creds sont stables au runtime).
let cachedClient: S3Client | null = null;

/**
 * Client S3 pointé sur l'endpoint S3-compatible de R2
 * (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`).
 */
export function getR2Client(env: R2Env): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return cachedClient;
}

/**
 * Valide qu'un `path` (clé d'objet) appartient bien au dossier de l'appelant.
 * MIROIR EXACT de la policy RLS `avatar_upload` (supabase/storage.sql) : le
 * PREMIER segment du path DOIT être l'`userId` de l'appelant. C'est l'AuthZ
 * applicative qui remplace la policy RLS write (R2 n'a pas de RLS).
 * Rejette aussi tout `..` (anti-traversée) et les chemins vides.
 */
export function isPathOwnedBy(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  if (path.includes('..')) return false;
  const segments = path.split('/');
  return segments.length >= 2 && segments[0] === userId && segments[1] !== '';
}
