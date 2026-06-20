'use client';
import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook. Returns `false` on the server and before the first
 * client mount (so initial render matches the server HTML, avoiding hydration
 * mismatches), then subscribes to `matchMedia` and updates on changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    // Sync immediately in case the query already matches at mount.
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Convenience: true on phone-sized viewports (≤767px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
