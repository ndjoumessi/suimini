'use client';
import { useCallback, useEffect } from 'react';
import { ColorThemeId } from '@/types';
import { applyColorTheme, THEME_STORAGE_KEY } from '@/lib/themes';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Modern Heritage is DARK BY DESIGN — there is no light theme and no toggle.
 * This hook locks the app to dark: it sets <html data-theme="dark">, keeps the
 * PWA chrome color in sync, and (re)applies the chosen colour theme.
 * The `toggle` / `setMode` API is kept as no-ops so existing callers compile.
 */
export function useDarkMode() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#111118');
    try {
      const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ColorThemeId | null) || 'sepia';
      applyColorTheme(storedTheme);
    } catch { /* localStorage unavailable — ignore */ }
  }, []);

  const noop = useCallback(() => {}, []);

  return { dark: true as const, toggle: noop, mode: 'dark' as ThemeMode, setMode: noop };
}
