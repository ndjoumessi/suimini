'use client';
import { useEffect } from 'react';

/**
 * Removes the `_l` cache-bust param left by switchLocale() from the address bar
 * after the (correctly-localized) page has loaded. Cosmetic only — the locale is
 * already applied via the cookie. Mounted once in the root layout.
 */
export default function LocaleParamCleaner() {
  useEffect(() => {
    if (!window.location.search.includes('_l=')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('_l');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}
