import { ColorTheme, ColorThemeId } from '@/types';

export const THEME_STORAGE_KEY = 'suimini_color_theme';

export const COLOR_THEMES: ColorTheme[] = [
  { id: 'sepia',    name: 'Sépia',    emoji: '📜', accent: '#8b6f47', male: '#3b6fa0', female: '#a05070' },
  { id: 'slate',    name: 'Ardoise',  emoji: '🪨', accent: '#566573', male: '#4a7a9a', female: '#9a6a82' },
  { id: 'forest',   name: 'Forêt',    emoji: '🌲', accent: '#4a7c59', male: '#3b7a6a', female: '#9c6b4a' },
  { id: 'bordeaux', name: 'Bordeaux', emoji: '🍷', accent: '#8b3a52', male: '#7a4a6a', female: '#b3556e' },
  { id: 'marine',   name: 'Marine',   emoji: '⚓', accent: '#2c5f8a', male: '#3b6fa0', female: '#5a7a9a' },
  { id: 'midnight', name: 'Minuit',   emoji: '🌙', accent: '#6a5acd', male: '#5b6fc0', female: '#9a6ac0' },
];

export function getTheme(id: ColorThemeId): ColorTheme {
  return COLOR_THEMES.find(t => t.id === id) || COLOR_THEMES[0];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function shade(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (c * percent) / 100)));
  return `#${[f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Apply a color theme by overriding accent/male/female CSS variables on <html>. */
export function applyColorTheme(id: ColorThemeId) {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  const root = document.documentElement;
  const [r, g, b] = hexToRgb(theme.accent);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-hover', shade(theme.accent, -14));
  root.style.setProperty('--accent-light', `rgba(${r}, ${g}, ${b}, 0.14)`);
  root.style.setProperty('--male', theme.male);
  root.style.setProperty('--female', theme.female);
}
