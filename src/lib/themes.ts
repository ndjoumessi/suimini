import { ColorTheme, ColorThemeId } from '@/types';

export const THEME_STORAGE_KEY = 'suimini_color_theme';

// Atelier palette: each accent is tuned to sit on the bone (#f4f1ea) / ink
// (#1b1b1b) canvas with hard-offset shadows. `id` values stay stable for
// localStorage compatibility; the default ('sepia') now carries terracotta.
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'sepia',    name: 'Terracotta', emoji: '🧱', accent: '#bf4b2c', male: '#2c5f8a', female: '#a8456b' },
  { id: 'slate',    name: 'Ardoise',    emoji: '🪨', accent: '#4a5a66', male: '#3f6f8e', female: '#8e5a72' },
  { id: 'forest',   name: 'Forêt',      emoji: '🌲', accent: '#2f6e4f', male: '#356b6a', female: '#9c6b4a' },
  { id: 'bordeaux', name: 'Bordeaux',   emoji: '🍷', accent: '#8e2f44', male: '#7a4a6a', female: '#b3556e' },
  { id: 'marine',   name: 'Marine',     emoji: '⚓', accent: '#2c5f8a', male: '#3b6fa0', female: '#5a7a9a' },
  { id: 'midnight', name: 'Indigo',     emoji: '🌙', accent: '#4338ca', male: '#5b6fc0', female: '#9a6ac0' },
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

function isDarkActive(): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Apply a color theme by overriding accent/male/female CSS variables on <html>.
 *
 * These inline vars sit on top of the `[data-theme="dark"]` stylesheet block, so
 * applyColorTheme must itself be dark-aware — otherwise the light accent/gender
 * colours leak into dark mode (DESIGN.md wants the cuir-taupe accent to brighten
 * to bronze in dark for contrast). In dark we brighten multiplicatively, which
 * preserves each theme's hue (e.g. sépia #8b6f47 → ~#c9a167 bronze) instead of
 * washing it toward grey. Must be re-applied whenever `data-theme` flips
 * (see useDarkMode), since it reads the current mode at call time.
 */
export function applyColorTheme(id: ColorThemeId) {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  const root = document.documentElement;
  const dark = isDarkActive();

  const accent = dark ? shade(theme.accent, 45) : theme.accent;
  const accentHover = dark ? shade(theme.accent, 62) : shade(theme.accent, -14);
  const male = dark ? shade(theme.male, 28) : theme.male;
  const female = dark ? shade(theme.female, 28) : theme.female;
  const [r, g, b] = hexToRgb(accent);

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-light', `rgba(${r}, ${g}, ${b}, ${dark ? 0.20 : 0.14})`);
  root.style.setProperty('--male', male);
  root.style.setProperty('--female', female);
}
