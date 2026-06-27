import { LOCALE_COOKIE, type Locale } from './config';

/**
 * Switch the active locale (next-intl "without routing").
 *
 * Why this shape: the locale lives in the NEXT_LOCALE cookie, read server-side by
 * getRequestConfig. The reliable way to apply it is:
 *   1. Set the cookie SYNCHRONOUSLY client-side (so it's in the jar before any request).
 *   2. Do a full navigation to a CACHE-BUSTED url (unique `_l` param).
 *
 * The earlier `/api/locale` 302 approach raced: the browser could issue the
 * redirected `GET /` before committing the redirect's Set-Cookie, so the page
 * rendered one switch behind (cookie correct, render stale). Setting the cookie
 * ourselves first + a unique URL (defeats browser/bfcache reuse of the document)
 * removes both the race and any caching variable. `LocaleParamCleaner` strips the
 * `_l` param after load so it never lingers in the address bar.
 */
export function switchLocale(next: Locale) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* ignore */ }
  // Remember scroll so the reloaded page lands where the user was (restored by
  // LocaleParamCleaner once the new locale has rendered).
  try { sessionStorage.setItem('localeScrollY', String(window.scrollY)); } catch { /* ignore */ }
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  const url = new URL(window.location.href);
  url.searchParams.set('_l', next);
  const go = () => window.location.replace(url.toString());
  // Fade the current page out, then navigate (skip the wait under reduced motion).
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { go(); return; }
  try { document.body.classList.add('locale-switching'); } catch { /* ignore */ }
  window.setTimeout(go, 150);
}
