import { ColorTheme, ColorThemeId } from '@/types';

export const THEME_STORAGE_KEY = 'suimini_color_theme';

// Modern Heritage palette (dark): each accent is tuned to sit on the near-black
// (#0d0d0d) / cream (#f5f0e8) canvas. `id` values stay stable for localStorage
// compatibility; the default ('sepia') carries the muted gold (Or).
// Gender colours are intentionally theme-INDEPENDENT: they must match the tree's
// GENDER_BAR (#4A90D9 / #C47BA0, defined in tree/nodeStyle.ts) so nodes, the legend,
// statistics, timeline and badges all read the same hue whatever the accent theme.
// applyColorTheme writes these as inline <html> vars, so they (not globals.css) are
// the effective runtime value — keep all three in sync.
const GENDER_MALE = '#4a90d9';
const GENDER_FEMALE = '#c47ba0';
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'sepia',    name: 'Or',       emoji: '🥇', accent: '#c9a84c', male: GENDER_MALE, female: GENDER_FEMALE },
  { id: 'bordeaux', name: 'Bordeaux', emoji: '🍷', accent: '#c06b78', male: GENDER_MALE, female: GENDER_FEMALE },
  { id: 'forest',   name: 'Forêt',    emoji: '🌲', accent: '#6fae8a', male: GENDER_MALE, female: GENDER_FEMALE },
  { id: 'slate',    name: 'Ardoise',  emoji: '🪨', accent: '#8aa2b4', male: GENDER_MALE, female: GENDER_FEMALE },
  { id: 'marine',   name: 'Marine',   emoji: '⚓', accent: '#5b8fc0', male: GENDER_MALE, female: GENDER_FEMALE },
  { id: 'terracotta', name: 'Terracotta', emoji: '🧱', accent: '#d3845a', male: GENDER_MALE, female: GENDER_FEMALE },
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
 * The raw theme accent is the brand FILL/RULE/CTA colour (kept as picked,
 * e.g. gold #c9a84c) — it doesn't change with light/dark, so switching mode
 * never changes WHICH accent is active, only how its derivatives are tuned.
 * `--accent-hover`/`--accent-text` DO depend on the canvas: on the dark
 * "Veillée" canvas the accent is brightened (a mid-tone pastel needs to lift
 * off near-black) ; on the light canvas it's darkened instead (the same
 * pastel would all but vanish as small text on cream paper — verified
 * computationally: the dark-mode accent-text derivative for "Or" sits at a
 * 1.8:1 contrast ratio against the light canvas, nowhere near WCAG AA).
 * `-40%` was chosen as the darkening amount because it's the smallest shift
 * that keeps every one of the 6 themes (including the lightest, "Ardoise")
 * at ≥4.5:1 against both the light canvas and light card surfaces.
 *
 * Gender colours (`--male`/`--female`) are intentionally left mode-INDEPENDENT
 * (not darkened for light mode) so they stay pixel-identical to the tree's
 * hardcoded GENDER_BAR (`tree/nodeStyle.ts`, itself mode-independent) — a
 * documented invariant this function must not break. This does mean gender
 * badges/legend text sit a little under the 4.5:1 AA text bar in light mode
 * (they were tuned as vivid FILLS against dark card surfaces) — a known,
 * deliberate trade-off pending a dedicated pass on GENDER_BAR itself, not a
 * regression introduced silently.
 */
export function applyColorTheme(id: ColorThemeId, mode?: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  const root = document.documentElement;
  const resolvedMode = mode ?? (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const light = resolvedMode === 'light';

  const accent = theme.accent;                                  // brand fill / rule / CTA — same in both modes
  const accentHover = shade(theme.accent, light ? -14 : 14);     // dark: brighten to lift off near-black · light: darken (pressed/hover deepens on paper)
  const accentText = shade(theme.accent, light ? -40 : 12);      // dark: brighten for AA on near-black · light: darken for AA on paper
  const [r, g, b] = hexToRgb(accent);

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-text', accentText);
  root.style.setProperty('--accent-light', `rgba(${r}, ${g}, ${b}, ${light ? 0.18 : 0.14})`);
  root.style.setProperty('--male', theme.male);
  root.style.setProperty('--female', theme.female);
}
