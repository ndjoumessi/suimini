import { ColorTheme, ColorThemeId } from '@/types';

export const THEME_STORAGE_KEY = 'suimini_color_theme';

// Modern Heritage palette (dark): each accent is tuned to sit on the near-black
// (#0d0d0d) / cream (#f5f0e8) canvas. `id` values stay stable for localStorage
// compatibility; the default ('sepia') carries the muted gold (Or).
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'sepia',    name: 'Or',       emoji: '🥇', accent: '#c9a84c', male: '#5b7fa6', female: '#b07d92' },
  { id: 'bordeaux', name: 'Bordeaux', emoji: '🍷', accent: '#c06b78', male: '#5b7fa6', female: '#b07d92' },
  { id: 'forest',   name: 'Forêt',    emoji: '🌲', accent: '#6fae8a', male: '#5b8a8a', female: '#b07d92' },
  { id: 'slate',    name: 'Ardoise',  emoji: '🪨', accent: '#8aa2b4', male: '#5b7fa6', female: '#b07d92' },
  { id: 'marine',   name: 'Marine',   emoji: '⚓', accent: '#5b8fc0', male: '#5b7fa6', female: '#8aa0c0' },
  { id: 'terracotta', name: 'Terracotta', emoji: '🧱', accent: '#d3845a', male: '#5b7fa6', female: '#b07d92' },
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

/**
 * Apply a color theme by overriding accent/male/female CSS variables on <html>.
 *
 * Editorial Heritage is light-only: the raw theme accent is the brand
 * FILL/RULE/CTA colour (kept as picked, e.g. gold #a36b1e), while `--accent-text`
 * is a DEEPER sibling used wherever the accent is small TEXT (eyebrows, links,
 * key numbers) so it clears WCAG AA on the cream/white paper. Gender signal
 * colours are used as picked (already tuned for light).
 */
export function applyColorTheme(id: ColorThemeId) {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  const root = document.documentElement;

  const accent = theme.accent;                 // brand fill / rule / CTA
  const accentHover = shade(theme.accent, 14); // brighter on hover (dark canvas)
  const accentText = shade(theme.accent, 12);  // brighter for AA text contrast on dark
  const [r, g, b] = hexToRgb(accent);

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-text', accentText);
  root.style.setProperty('--accent-light', `rgba(${r}, ${g}, ${b}, 0.14)`);
  root.style.setProperty('--male', theme.male);
  root.style.setProperty('--female', theme.female);
}
