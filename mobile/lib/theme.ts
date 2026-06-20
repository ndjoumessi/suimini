/**
 * ATELIER — Warm Brutalist design system (mobile port).
 * Bone canvas · ink rules · terracotta accent · hard-offset shadows.
 * Mirrors src/app/globals.css from the web app. Keep the token names stable.
 */

export const colors = {
  bone: '#f4f1ea',
  ink: '#1b1b1b',
  accent: '#bf4b2c',
  accentHover: '#a53e22',

  // Information signals (gender / status) — not decoration.
  male: '#2c5f8a',
  female: '#a8456b',
  deceased: '#6e6a62',
  success: '#0e6e63',
  danger: '#9e2b25',
  warning: '#c77d1a',

} as const;

export type ThemeName = 'light' | 'dark';

/** Resolved per-scheme palette consumed throughout the UI via useTheme(). */
export interface Palette {
  bg: string;
  bgCard: string;
  bgMuted: string;
  text: string;
  textMuted: string;
  textLight: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentLight: string;
  scrim: string;
  danger: string;
  success: string;
  bone: string;
}

const lightPalette: Palette = {
  bg: '#f4f1ea',
  bgCard: '#ffffff',
  bgMuted: '#ece7dc',
  text: '#1b1b1b',
  textMuted: '#4a4742',
  textLight: '#6e6a62',
  border: '#d8d2c6',
  borderStrong: '#1b1b1b',
  accent: '#bf4b2c',
  accentLight: '#f6e1d8',
  scrim: 'rgba(27, 22, 18, 0.55)',
  danger: '#9e2b25',
  success: '#0e6e63',
  bone: '#f4f1ea',
};

// "Atelier nuit"
const darkPalette: Palette = {
  bg: '#161412',
  bgCard: '#211e1a',
  bgMuted: '#2a2620',
  text: '#f4f1ea',
  textMuted: '#b8b2a6',
  textLight: '#8a8276',
  border: '#36312a',
  borderStrong: '#7b7264',
  accent: '#e0623e',
  accentLight: '#2e211b',
  scrim: 'rgba(0, 0, 0, 0.7)',
  danger: '#c85248',
  success: '#2f9c8e',
  bone: '#f4f1ea',
};

export function palette(scheme: ThemeName): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}

/**
 * Font family names. These MUST match the keys passed to useFonts() in
 * hooks/useTheme.ts (loaded from @expo-google-fonts/*). React Native does not
 * synthesize bold for custom families, so weights are distinct families.
 */
export const fonts = {
  display: 'BricolageGrotesque',     // headings, names, key numbers (700)
  body: 'HankenGrotesk',             // body (400)
  bodyBold: 'HankenGroteskBold',     // emphasised body (700)
  mono: 'IBMPlexMono',               // labels, dates, eyebrows (400)
  monoBold: 'IBMPlexMonoBold',       // strong labels (600)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0, // Atelier = zero radius
  sm: 2, // light exception
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 34,
  display: 44,
} as const;

export const shadows = {
  // Hard ink shadow — flat at rest, shadow answers state.
  hard: {
    shadowColor: '#1b1b1b',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  hardSm: {
    shadowColor: '#1b1b1b',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  hardAccent: {
    shadowColor: '#bf4b2c',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
} as const;

/** Structural border width (matches --bw). */
export const borderWidth = 1.5;

/** Color for a person's left "spine" — gender/status signal. */
export function getRoleColor(person: {
  gender?: string;
  isAlive?: boolean;
}): string {
  if (person.isAlive === false) return colors.deceased;
  if (person.gender === 'male') return colors.male;
  if (person.gender === 'female') return colors.female;
  return colors.accent;
}
