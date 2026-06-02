'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ColorThemeId } from '@/types';
import { applyColorTheme, THEME_STORAGE_KEY } from '@/lib/themes';

export type ThemeMode = 'light' | 'dark' | 'system';
const MODE_KEY = 'suimini_theme_mode';
const LEGACY_KEY = 'suimini_theme';
const MODE_EVENT = 'suimini:theme-mode'; // same-tab notification (storage event only fires cross-tab)

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolve the persisted mode (new key → legacy key → system). */
function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(MODE_KEY) as ThemeMode | null;
  const legacy = localStorage.getItem(LEGACY_KEY); // 'light' | 'dark'
  return stored || (legacy === 'dark' || legacy === 'light' ? legacy : 'system');
}

function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && prefersDark());
}

const readDark = () => resolveDark(readMode());

/**
 * The mode/dark pair is external state (localStorage + the OS colour scheme), so we
 * read it through useSyncExternalStore: it subscribes to our own writes, cross-tab
 * `storage` events, and OS scheme changes, and uses a server snapshot so SSR and
 * hydration agree (no hydration mismatch, no setState-in-effect).
 */
function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(MODE_EVENT, cb);
  window.addEventListener('storage', cb);
  mq.addEventListener('change', cb);
  return () => {
    window.removeEventListener(MODE_EVENT, cb);
    window.removeEventListener('storage', cb);
    mq.removeEventListener('change', cb);
  };
}

export function useDarkMode() {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'system' as ThemeMode);
  const dark = useSyncExternalStore(subscribe, readDark, () => false);

  // Side effect only (no setState): keep <html data-theme> + the colour theme in
  // sync with the resolved mode. Re-applying the colour theme resolves its accent /
  // gender variables to the light or dark variant (see themes.ts / applyColorTheme).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try {
      const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ColorThemeId | null) || 'sepia';
      applyColorTheme(storedTheme);
    } catch { /* localStorage unavailable — ignore */ }
  }, [dark]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(MODE_KEY, next);
    localStorage.removeItem(LEGACY_KEY);
    window.dispatchEvent(new Event(MODE_EVENT)); // notify the store in this tab
  }, []);

  // Simple light/dark toggle (used by the sidebar button) — picks the opposite of the current rendering.
  const toggle = useCallback(() => {
    setMode(readDark() ? 'light' : 'dark');
  }, [setMode]);

  return { dark, toggle, mode, setMode };
}
