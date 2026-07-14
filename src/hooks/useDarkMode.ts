'use client';
import { useCallback, useEffect, useState } from 'react';
import { ColorThemeId } from '@/types';
import { applyColorTheme, THEME_STORAGE_KEY } from '@/lib/themes';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_STORAGE_KEY = 'suimini_theme_mode';
// Littéraux obligatoires : <meta name="theme-color"> ne résout pas les CSS vars.
const THEME_COLOR: Record<'light' | 'dark', string> = { dark: '#0f1a24', light: '#F4F0E6' };

function resolveSystemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Pushes a resolved (never 'system') mode to the DOM + re-derives the active
 *  colour theme's accent shades for that canvas (see applyColorTheme). */
function applyResolved(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved; // native controls (date pickers, scrollbars) follow too
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
  try {
    const storedColorTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ColorThemeId | null) || 'sepia';
    applyColorTheme(storedColorTheme, resolved);
  } catch { /* localStorage unavailable — ignore */ }
}

/**
 * Light/dark/system, user-chosen and persisted — re-introduces what an
 * earlier pass of this hook had hardcoded away entirely (`data-theme` was
 * locked to `"dark"`, `toggle`/`setMode` were no-ops "so existing callers
 * compile"). `globals.css` now ships a full `[data-theme="light"]` token set
 * (a paper-warm companion to "Veillée", contrast-checked against all 6 accent
 * themes) so there's something real to switch TO.
 *
 * Defaults to 'dark' when no preference is stored yet (matches the SSR
 * `<html data-theme="dark">` in layout.tsx — Veillée stays the first
 * impression) — 'system' only takes over once the user explicitly picks it.
 */
export function useDarkMode() {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Read the stored preference once on mount and apply it.
  useEffect(() => {
    let stored: ThemeMode = 'dark';
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
    } catch { /* localStorage unavailable — ignore */ }
    setModeState(stored);
    applyResolved(stored === 'system' ? resolveSystemPref() : stored);
  }, []);

  // While on 'system', keep following the OS preference live (no reload needed).
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyResolved(resolveSystemPref());
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* ignore */ }
    applyResolved(next === 'system' ? resolveSystemPref() : next);
  }, []);

  const toggle = useCallback(() => {
    setMode((mode === 'system' ? resolveSystemPref() : mode) === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const dark = (mode === 'system' ? resolveSystemPref() : mode) === 'dark';
  return { dark, toggle, mode, setMode };
}
