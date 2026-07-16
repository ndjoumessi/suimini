/**
 * POST /api/storage/delete  { path }
 *
 * Suppression best-effort d'un objet du bucket R2 `suimini-avatars`, sous
 * l'identité de l'appelant. La suppression exige la clé secrète R2 → elle doit
 * passer par le serveur (contrairement au read, qui est public). Miroir exact de
 * l'AuthZ de sign-upload : le `path` DOIT commencer par `${caller.userId}/` (=
 * policy RLS `avatar_delete`). On ne saute PAS l'AuthZ juste parce que c'est un
 * DELETE.
 *
 * Best-effort : renvoie 200 `{ ok }` même si l'objet n'existait pas (idempotent),
 * et n'expose jamais les clés secrètes. 503 clair si R2 non configuré.
 */
import { NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getServerAuth } from '@/lib/apiAuth';
import { getR2Client, isPathOwnedBy, readR2Env } from '@/lib/r2';
import { checkOrigin } from '@/lib/apiData';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  const env = readR2Env();
  if (!env) {
    return NextResponse.json(
      { error: 'Stockage objet non configuré (R2_* manquants).' },
      { status: 503 },
    );
  }

  const { caller } = await getServerAuth();
  if (!caller) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }
  const path = body.path?.trim();
  if (!path) return NextResponse.json({ error: 'path manquant.' }, { status: 400 });

  if (!isPathOwnedBy(path, caller.userId)) {
    return NextResponse.json(
      { error: 'Chemin interdit : le premier segment doit être votre identifiant.' },
      { status: 403 },
    );
  }

  try {
    const client = getR2Client(env);
    await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: path }));
  } catch {
    // Best-effort : la suppression du storage est opportuniste (comme le
    // passe-plat Supabase qui avale l'erreur). L'important côté UI = l'URL a
    // déjà été retirée de la fiche personne.
  }
  return NextResponse.json({ ok: true });
}
