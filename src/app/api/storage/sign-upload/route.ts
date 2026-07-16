/**
 * POST /api/storage/sign-upload  { path, contentType }
 *
 * Émet une URL d'upload PRÉSIGNÉE (PUT) DE COURTE DURÉE (5 min) pour un objet du
 * bucket R2 `suimini-avatars`, sous l'identité de l'appelant. Le navigateur/mobile
 * PUT ensuite les octets DIRECTEMENT vers R2 avec cette URL — les bytes ne
 * transitent JAMAIS par ce serveur (tout l'intérêt d'une URL présignée).
 *
 * ⚠️ Les clés SECRÈTES R2 ne sont JAMAIS exposées au client : seule cette route
 * (server-only, lib/r2.ts) les lit, et ne renvoie qu'une URL signée éphémère.
 *
 * AuthZ applicative (remplace la policy RLS `avatar_upload` — R2 n'a pas de RLS) :
 * le `path` est un INPUT contrôlé par l'appelant → on IMPOSE que son premier
 * segment soit `${caller.userId}/…` (miroir exact de la policy Supabase), sinon
 * 403. C'est le même patron que `authz.ts` a substitué à la RLS data.
 *
 * Échec GRACIEUX (comme les routes email sans RESEND_API_KEY) : 503 clair si R2
 * n'est pas configuré (env manquants), jamais un crash.
 */
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerAuth } from '@/lib/apiAuth';
import { getR2Client, isPathOwnedBy, readR2Env } from '@/lib/r2';
import { checkOrigin } from '@/lib/apiData';

// Node runtime (SDK AWS + crypto de signature).
export const runtime = 'nodejs';

// Durée de vie de l'URL présignée. Assez pour un upload compressé (≤800px webp),
// assez court pour limiter la fenêtre d'usage si l'URL fuit.
const EXPIRY_SECONDS = 300; // 5 minutes

export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  // --- R2 configuré ? (échec gracieux, pas de crash) ---
  const env = readR2Env();
  if (!env) {
    return NextResponse.json(
      { error: 'Stockage objet non configuré (R2_* manquants).' },
      { status: 503 },
    );
  }

  // --- AuthN : appelant résolu comme les autres routes /api/data/* ---
  // (cookie de session web OU Authorization: Bearer mobile — voir apiAuth.ts).
  const { caller } = await getServerAuth();
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // --- Payload ---
  let body: { path?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }
  const path = body.path?.trim();
  const contentType = body.contentType?.trim();
  if (!path) return NextResponse.json({ error: 'path manquant.' }, { status: 400 });
  if (!contentType) return NextResponse.json({ error: 'contentType manquant.' }, { status: 400 });

  // --- AuthZ applicative : le path DOIT commencer par `${caller.userId}/` ---
  // Miroir exact de la policy RLS `avatar_upload` (1er segment = auth.uid()).
  if (!isPathOwnedBy(path, caller.userId)) {
    return NextResponse.json(
      { error: 'Chemin interdit : le premier segment doit être votre identifiant.' },
      { status: 403 },
    );
  }

  // --- URL présignée PUT vers R2 ---
  try {
    const client = getR2Client(env);
    const command = new PutObjectCommand({
      Bucket: env.bucket,
      Key: path,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: EXPIRY_SECONDS });

    // publicUrl renvoyée par commodité (le client peut aussi la reconstruire via
    // NEXT_PUBLIC_R2_PUBLIC_BASE_URL — voir ObjectStoreProvider.getPublicUrl).
    const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
    const publicUrl = base ? `${base}/${path}` : null;

    return NextResponse.json({ uploadUrl, publicUrl, expiresIn: EXPIRY_SECONDS });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Échec de la signature.';
    return NextResponse.json({ error: `Signature R2 échouée — ${message}` }, { status: 502 });
  }
}
