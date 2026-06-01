'use client';
import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const MODE_KEY = 'suimini_theme_mode';
const LEGACY_KEY = 'suimini_theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark());
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  return isDark;
}

export function useDarkMode() {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Resolve initial mode (new key → legacy key → system).
    const stored = localStorage.getItem(MODE_KEY) as ThemeMode | null;
    const legacy = localStorage.getItem(LEGACY_KEY); // 'light' | 'dark'
    const initial: ThemeMode = stored || (legacy === 'dark' || legacy === 'light' ? legacy : 'system');
    setModeState(initial);
    setDark(apply(initial));

    // Follow OS changes while in "system" mode.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem(MODE_KEY) as ThemeMode | null) === 'system' || !localStorage.getItem(MODE_KEY)) {
        setDark(apply('system'));
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setDark(apply(next));
    localStorage.setItem(MODE_KEY, next);
    localStorage.removeItem(LEGACY_KEY);
  }, []);

  // Simple light/dark toggle (used by the sidebar button) — picks the opposite of the current rendering.
  const toggle = useCallback(() => {
    setMode(dark ? 'light' : 'dark');
  }, [dark, setMode]);

  return { dark, toggle, mode, setMode };
}
