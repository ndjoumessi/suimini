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
    // Restore scroll where the user was before the switch. The page may not be tall
    // enough yet at mount (fonts/sections still laying out), so scrollTo would clamp
    // to 0 — retry across a few frames until we actually reach the target.
    try {
      const raw = sessionStorage.getItem('localeScrollY');
      if (raw !== null) {
        sessionStorage.removeItem('localeScrollY');
        const target = parseInt(raw, 10) || 0;
        if (target > 0) {
          let tries = 0;
          const restore = () => {
            window.scrollTo({ top: target, left: 0, behavior: 'instant' as ScrollBehavior });
            tries += 1;
            if (Math.abs(window.scrollY - target) > 2 && tries < 30) requestAnimationFrame(restore);
          };
          requestAnimationFrame(restore);
        }
      }
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
