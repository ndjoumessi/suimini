import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, isLocale, DEFAULT_LOCALE } from '@/i18n/config';

/**
 * Locale switch endpoint (no i18n URL routing). The toggle navigates here; we set
 * the NEXT_LOCALE cookie SERVER-SIDE and 302 back to the originating page. The
 * browser then loads that page fresh WITH the new cookie already applied — so the
 * server layout (getLocale/getMessages) reads it on the very first render.
 *
 * Why a redirect instead of document.cookie + reload / router.refresh:
 *  - router.refresh() returns a stale Router-Cache RSC payload → the switch lags a
 *    click (and the back-direction never applies).
 *  - window.location.reload() can serve a stale document and, after a prior
 *    language reload, doesn't re-read the cookie reliably.
 *  A server redirect is a brand-new navigation (the same path the initial demo
 *  entry uses, which always works), so it is immune to both caches.
 */
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to');
  const nextParam = req.nextUrl.searchParams.get('next') || '/';
  // Only allow same-origin relative paths as the redirect target (no open redirect).
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  const locale = isLocale(to) ? to : DEFAULT_LOCALE;

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
  return res;
}
