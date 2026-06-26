import { ColorTheme, ColorThemeId } from '@/types';

export const THEME_STORAGE_KEY = 'suimini_color_theme';

// Editorial Heritage palette: each accent is tuned to sit on the cream
// (#fbf7ef) / ink (#1a1714) paper. `id` values stay stable for localStorage
// compatibility; the default ('sepia') now carries the muted gold (Or).
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'sepia',    name: 'Or',       emoji: '🥇', accent: '#a36b1e', male: '#2c5f8a', female: '#a8456b' },
  { id: 'bordeaux', name: 'Bordeaux', emoji: '🍷', accent: '#7b2d3a', male: '#7a4a6a', female: '#b3556e' },
  { id: 'forest',   name: 'Forêt',    emoji: '🌲', accent: '#2f6e4f', male: '#356b6a', female: '#9c6b4a' },
  { id: 'slate',    name: 'Ardoise',  emoji: '🪨', accent: '#3f5566', male: '#3f6f8e', female: '#8e5a72' },
  { id: 'marine',   name: 'Marine',   emoji: '⚓', accent: '#2c5f8a', male: '#3b6fa0', female: '#5a7a9a' },
  { id: 'terracotta', name: 'Terracotta', emoji: '🧱', accent: '#b5651d', male: '#2c5f8a', female: '#a8456b' },
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

  const accent = theme.accent;                  // brand fill / rule / CTA
  const accentHover = shade(theme.accent, -14); // darker on hover
  const accentText = shade(theme.accent, -28);  // deeper for AA text contrast on cream
  const [r, g, b] = hexToRgb(accent);

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-text', accentText);
  root.style.setProperty('--accent-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
  root.style.setProperty('--male', theme.male);
  root.style.setProperty('--female', theme.female);
}
