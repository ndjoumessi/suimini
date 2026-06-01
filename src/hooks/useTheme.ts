'use client';
import { useState, useEffect, useCallback } from 'react';
import { ColorThemeId } from '@/types';
import { COLOR_THEMES, applyColorTheme, THEME_STORAGE_KEY } from '@/lib/themes';

export function useTheme() {
  const [themeId, setThemeId] = useState<ColorThemeId>('sepia');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ColorThemeId | null;
    const id = stored && COLOR_THEMES.some(t => t.id === stored) ? stored : 'sepia';
    setThemeId(id);
    applyColorTheme(id);
  }, []);

  const setTheme = useCallback((id: ColorThemeId) => {
    setThemeId(id);
    applyColorTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  // Live preview (e.g. on hover) without persisting.
  const previewTheme = useCallback((id: ColorThemeId) => {
    applyColorTheme(id);
  }, []);

  // Restore the currently-selected theme after a preview.
  const cancelPreview = useCallback(() => {
    applyColorTheme(themeId);
  }, [themeId]);

  return { themeId, setTheme, previewTheme, cancelPreview };
}
