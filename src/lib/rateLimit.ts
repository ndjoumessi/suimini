import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Rate limiting des routes IA (Anthropic) — par utilisateur connecté via la RPC
 * Supabase `consume_rate_limit` (fenêtre fixe, table api_rate_limits, migration
 * supabase/rate-limits.sql), et par IP en mémoire (best-effort, par instance
 * serverless) pour les appels anonymes (mode démo).
 *
 * Fail-open assumé : si la RPC n'existe pas encore (migration non exécutée) ou
 * si Supabase est injoignable, la requête PASSE — le rate limiting est une
 * protection de coût, pas une fonction critique ; il ne doit jamais casser
 * les fonctionnalités pré-migration.
 */

export const RATE_LIMITS = {
  '/api/narrative':        { max: 10, windowSeconds: 3600 },
  '/api/narrative-person': { max: 10, windowSeconds: 3600 },
  '/api/analyze-photo':    { max: 5,  windowSeconds: 3600 },
  '/api/ocr-document':     { max: 5,  windowSeconds: 3600 },
  '/api/search':           { max: 20, windowSeconds: 3600 },
} as const;
export type RateLimitedEndpoint = keyof typeof RATE_LIMITS;

// Repli anonyme : compteurs en mémoire par IP (perdus au recyclage de
// l'instance — acceptable pour brider un usage abusif du mode démo).
const anonWindows = new Map<string, { count: number; windowStart: number }>();
const ANON_MAX_ENTRIES = 5000;

function anonAllowed(key: string, max: number, windowSeconds: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const w = anonWindows.get(key);
  if (!w || now - w.windowStart > windowSeconds * 1000) {
    if (anonWindows.size > ANON_MAX_ENTRIES) anonWindows.clear(); // borne mémoire
    anonWindows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  w.count += 1;
  if (w.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((w.windowStart + windowSeconds * 1000 - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Locale du message 429 : cookie NEXT_LOCALE d'abord (la vraie locale de
 * l'app), Accept-Language en repli. */
function messageFor(locale: string, retryAfter: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return locale === 'en'
    ? `Limit reached — try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`
    : `Limite atteinte — réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}

/**
 * À appeler en tête de chaque handler POST concerné :
 *   const limited = await enforceRateLimit(req, '/api/narrative');
 *   if (limited) return limited;
 * Retourne null si autorisé, sinon la réponse 429 prête à renvoyer
 * (`{ error, code, retryAfter }` — `error` est déjà localisé, les UI
 * existantes qui affichent data.error n'ont rien à changer).
 */
export async function enforceRateLimit(req: Request, endpoint: RateLimitedEndpoint): Promise<NextResponse | null> {
  const { max, windowSeconds } = RATE_LIMITS[endpoint];

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale === 'en' || (!cookieLocale && (req.headers.get('accept-language') ?? '').toLowerCase().startsWith('en'))
    ? 'en' : 'fr';

  const deny = (retryAfter: number) => NextResponse.json(
    { error: messageFor(locale, retryAfter), code: 'rate_limit_exceeded', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Utilisateur connecté → RPC Supabase (compteur durable, partagé entre instances).
  if (url && key) {
    try {
      const supabase = createServerClient(url, key, {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => { /* lecture seule ici */ } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.rpc('consume_rate_limit', {
          p_endpoint: endpoint, p_max: max, p_window_seconds: windowSeconds,
        });
        if (error) {
          // RPC absente (migration pas encore passée) ou erreur transitoire → fail-open.
          console.warn(`[rateLimit] RPC indisponible (${error.code ?? ''} ${error.message}) — requête autorisée.`);
          return null;
        }
        const res = data as { allowed?: boolean; retry_after?: number } | null;
        if (res && res.allowed === false) return deny(res.retry_after ?? windowSeconds);
        return null;
      }
    } catch (err) {
      console.warn('[rateLimit] vérification impossible — requête autorisée.', err);
      return null;
    }
  }

  // Anonyme (démo) / Supabase non configuré → repli mémoire par IP.
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const verdict = anonAllowed(`${ip}:${endpoint}`, max, windowSeconds);
  return verdict.allowed ? null : deny(verdict.retryAfter);
}
