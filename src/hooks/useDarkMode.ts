'use client';
import { useCallback, useEffect } from 'react';
import { ColorThemeId } from '@/types';
import { applyColorTheme, THEME_STORAGE_KEY } from '@/lib/themes';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Editorial Heritage is LIGHT BY DESIGN — there is no dark theme and no toggle.
 * This hook locks the app to light: it sets <html data-theme="light">, keeps the
 * PWA chrome color in sync, and (re)applies the chosen colour theme.
 * The `toggle` / `setMode` API is kept as no-ops so existing callers compile.
 */
export function useDarkMode() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#fbf7ef');
    try {
      const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ColorThemeId | null) || 'sepia';
      applyColorTheme(storedTheme);
    } catch { /* localStorage unavailable — ignore */ }
  }, []);

  const noop = useCallback(() => {}, []);

  return { dark: false as const, toggle: noop, mode: 'light' as ThemeMode, setMode: noop };
}
