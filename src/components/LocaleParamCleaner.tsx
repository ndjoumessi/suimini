'use client';
import { useEffect } from 'react';

/**
 * Post locale-switch housekeeping (runs once on mount). After switchLocale()
 * reloads the page it:
 *  - restores the pre-switch scroll position (saved in sessionStorage),
 *  - ensures the fade-in class is cleared (safety net for the head script),
 *  - strips the `_l` cache-bust param from the address bar.
 * All cosmetic — the locale itself is already applied via the cookie.
 */
export default function LocaleParamCleaner() {
  useEffect(() => {
    // Restore scroll where the user was before the switch.
    try {
      const y = sessionStorage.getItem('localeScrollY');
      if (y !== null) { window.scrollTo({ top: parseInt(y, 10) || 0, behavior: 'instant' as ScrollBehavior }); sessionStorage.removeItem('localeScrollY'); }
    } catch { /* ignore */ }
    // Safety: make sure the body fades in even if the head load handler didn't run.
    document.documentElement.classList.remove('locale-enter');

    if (!window.location.search.includes('_l=')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('_l');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}
