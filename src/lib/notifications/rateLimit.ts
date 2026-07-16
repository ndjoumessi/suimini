import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Rate limiting des routes IA (Anthropic) — par utilisateur connecté via la RPC
 * Supabase `consume_rate_limit` (fenêtre fixe, table api_rate_limits, migration
 * supabase/rate-limits.sql), et par IP en mémoire (best-effort, par instance
 * serverless) pour les appels anonymes (mode démo).
 *
 * Fail-open SCOPÉ (sécu F4) : seule la RPC ABSENTE (migration `rate-limits.sql`
 * pas encore exécutée) fait passer la requête sans filet — c'est le bootstrap
 * volontaire, pour ne jamais casser les fonctionnalités pré-migration. Toute
 * AUTRE panne (réseau, Supabase injoignable, erreur transitoire) retombe sur
 * le compteur mémoire par IP (même filet que le mode anonyme/démo) plutôt que
 * de laisser passer sans aucune limite — borne le risque de coût en cas
 * d'incident, sans bloquer l'usage normal.
 */

export const RATE_LIMITS = {
  '/api/narrative':          { max: 10, windowSeconds: 3600 },
  '/api/narrative-person':   { max: 10, windowSeconds: 3600 },
  '/api/analyze-photo':      { max: 5,  windowSeconds: 3600 },
  '/api/ocr-document':       { max: 5,  windowSeconds: 3600 },
  '/api/search':             { max: 20, windowSeconds: 3600 },
  '/api/send-invite-email':  { max: 30, windowSeconds: 3600 }, // Sécu F5 : borne le spam d'invitations
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
          // Sécu F4 : seule la RPC ABSENTE (migration pas encore passée) fail-open
          // sans filet — c'est le cas bootstrap volontaire (pré-`rate-limits.sql`).
          // Toute AUTRE erreur (panne réseau, permission, Supabase indisponible…)
          // retombe sur le compteur mémoire par IP plutôt qu'un fail-open total :
          // ça borne le risque de coût (usage IA illimité) pendant un incident,
          // sans jamais bloquer un usage normal pré-migration.
          const code = error.code ?? '';
          const missingFn = code === '42883' || code === 'PGRST202' || /function .* does not exist/i.test(error.message ?? '');
          if (missingFn) {
            console.warn(`[rateLimit] RPC absente (migration non appliquée) — requête autorisée.`);
            return null;
          }
          console.warn(`[rateLimit] RPC en erreur (${code} ${error.message}) — repli par IP.`);
          const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
          const verdict = anonAllowed(`${ip}:${endpoint}:fallback`, max, windowSeconds);
          return verdict.allowed ? null : deny(verdict.retryAfter);
        }
        const res = data as { allowed?: boolean; retry_after?: number } | null;
        if (res && res.allowed === false) return deny(res.retry_after ?? windowSeconds);
        return null;
      }
    } catch (err) {
      // Panne de connexion à Supabase lui-même (pas seulement la RPC) : même repli
      // borné par IP plutôt qu'un fail-open total.
      console.warn('[rateLimit] vérification impossible — repli par IP.', err);
      const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
      const verdict = anonAllowed(`${ip}:${endpoint}:fallback`, max, windowSeconds);
      return verdict.allowed ? null : deny(verdict.retryAfter);
    }
  }

  // Anonyme (démo) / Supabase non configuré → repli mémoire par IP.
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const verdict = anonAllowed(`${ip}:${endpoint}`, max, windowSeconds);
  return verdict.allowed ? null : deny(verdict.retryAfter);
}

/**
 * À appeler quand une requête déjà comptée par `enforceRateLimit` échoue pour
 * une raison qui N'EST PAS imputable à l'utilisateur (panne/erreur Anthropic,
 * clé API absente, réponse illisible…) : redonne le crédit consommé pour que
 * l'incident ne rogne pas le quota horaire réel de la personne. À NE PAS
 * appeler pour une erreur imputable à l'utilisateur (image invalide, corps de
 * requête malformé) — celles-là restent décomptées.
 *
 * Best-effort et fail-silent (comme enforceRateLimit) : le repli anonyme par
 * IP n'a pas de compteur durable à libérer (accepté, ce chemin ne sert que le
 * mode démo) ; s'il n'y a pas de session utilisateur ou que Supabase n'est
 * pas configuré, on ne fait rien.
 */
export async function releaseRateLimit(endpoint: RateLimitedEndpoint): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => { /* lecture seule ici */ } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.rpc('release_rate_limit', { p_endpoint: endpoint });
    if (error) console.warn(`[rateLimit] libération impossible (${endpoint}) — ${error.message}`);
  } catch (err) {
    console.warn(`[rateLimit] libération impossible (${endpoint})`, err);
  }
}
