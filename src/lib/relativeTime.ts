/** Relative "time since" descriptor for the sync indicator. Returns a key from
 *  the `sync` i18n namespace plus an optional count, so callers render it with
 *  their own translator: `count != null ? t(key, { count }) : t(key)`. */
export function relativeSyncParts(ts: number): {
  key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo';
  count?: number;
} {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return { key: 'justNow' };
  const min = Math.floor(sec / 60);
  if (min < 60) return { key: 'minutesAgo', count: min };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { key: 'hoursAgo', count: hr };
  return { key: 'daysAgo', count: Math.floor(hr / 24) };
}
