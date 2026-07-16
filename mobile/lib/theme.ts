/**
 * CANOPÉE — design system mobile de Suimini (v2, refonte 2026-07).
 *
 * Direction visuelle : « archive botanique moderne ». L'arbre familial est
 * traité comme une canopée — papier chaud, encre végétale, vert forêt profond
 * en accent (menthe en sombre). Inspiration : apps de journaling/héritage
 * contemporaines (surfaces douces, arrondis francs, ombres diffuses basses),
 * en rupture assumée avec le brutalisme « Atelier » du web : le tactile
 * appelle des formes douces et une profondeur subtile, pas des règles dures.
 *
 * Décisions structurantes :
 * - RADIUS : système d'arrondis assumé (6→28 + pilule). Sur mobile, les
 *   arrondis suivent la forme du doigt et des écrans modernes ; le zéro-radius
 *   du web reste une signature desktop.
 * - PROFONDEUR : ombres diffuses très basses (opacité 6–16 %) + bordures
 *   hairline en clair ; en sombre, la hiérarchie vient des paliers de surface
 *   (bg → bgCard → bgMuted), pas des ombres.
 * - TYPO : DM Serif Display (titres, chiffres-clés — voix patrimoniale),
 *   Figtree (UI, 3 graisses), IBM Plex Mono réservé aux données généalogiques
 *   (dates, identifiants). Fini le mono-uppercase généralisé.
 */

export const colors = {
  /** Papier chaud — aussi la couleur de texte posée sur les fonds pleins (danger, etc.). */
  bone: '#F7F5F0',
  ink: '#212721',
  accent: '#2F6D4F',
  accentHover: '#265A41',

  // Signaux d'information (genre / statut) — pas de la décoration.
  male: '#41719A',
  female: '#A75B77',
  deceased: '#7A7568',
  unknown: '#7C7666',
  success: '#417B3A',
  danger: '#B23B2E',
  warning: '#B37F24',
} as const;

export type ThemeName = 'light' | 'dark';

/** Palette résolue par schéma, consommée partout via useTheme(). */
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
  /** Variante enfoncée de `accent` (état pressed des surfaces pleines). */
  accentPressed: string;
  /** Texte/icône posé SUR une surface pleine `accent`. */
  onAccent: string;
  scrim: string;
  danger: string;
  success: string;
  bone: string;
}

const lightPalette: Palette = {
  bg: '#F7F5F0',
  bgCard: '#FFFFFF',
  bgMuted: '#EDEAE1',
  text: '#212721',
  textMuted: '#59604F' /* ≥4.5:1 sur bg */,
  textLight: '#6B7266' /* ≥4.5:1 sur bg — plancher de contraste */,
  border: '#E4E0D5',
  borderStrong: '#C9C4B5',
  accent: '#2F6D4F' /* vert forêt — 6.1:1 sur blanc */,
  accentLight: '#E4EFE7',
  accentPressed: '#265A41',
  onAccent: '#FFFFFF',
  scrim: 'rgba(20, 26, 21, 0.5)',
  danger: '#B23B2E',
  success: '#37703A',
  bone: '#F7F5F0',
};

// « Canopée nuit » — vert charbon, accent menthe.
const darkPalette: Palette = {
  bg: '#141814',
  bgCard: '#1D221D',
  bgMuted: '#272D27',
  text: '#ECEAE1',
  textMuted: '#A8AEA0',
  textLight: '#8B9184',
  border: '#2B312A',
  borderStrong: '#3E453C',
  accent: '#8FC9A8' /* menthe — 8.9:1 sur bg */,
  accentLight: '#22372B',
  accentPressed: '#7AB593',
  onAccent: '#12211A',
  scrim: 'rgba(0, 0, 0, 0.62)',
  danger: '#E0705F',
  success: '#7FBF77',
  bone: '#F7F5F0',
};

export function palette(scheme: ThemeName): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}

/**
 * Familles de polices. Les clés DOIVENT correspondre à celles passées à
 * useFonts() dans hooks/useTheme.ts (chargées depuis @expo-google-fonts/*).
 * React Native ne synthétise pas le gras des familles custom → une famille
 * distincte par graisse.
 */
export const fonts = {
  display: 'DMSerifDisplay',       // titres d'écran, noms héros, chiffres-clés (400 — serif display)
  body: 'Figtree',                 // corps / UI (400)
  bodyMedium: 'FigtreeMedium',     // labels, overlines, éléments actifs (500)
  bodyBold: 'FigtreeBold',         // emphase, boutons, noms en liste (700)
  mono: 'IBMPlexMono',             // dates, tokens, données généalogiques (400)
  monoBold: 'IBMPlexMonoBold',     // données appuyées (600)
} as const;

/**
 * Grille d'espacement 4 pt : chaque token est un multiple de 4
 * (4 · 8 · 12 · 16 · 24 · 32 · 48). `smd` (12) comble le trou 8→16 des
 * listes denses ; tout écart hors grille est un bug de design.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Arrondis « Canopée » — progression douce, usage par rôle :
 * xs 6 = chips/tags · sm 10 = champs, petits boutons · md 14 = cartes de
 * liste · lg 20 = cartes héros, sheets · xl 28 = grandes surfaces modales ·
 * full = pilules, FAB, avatars.
 */
export const radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/**
 * Échelle typographique — ratio 1,2 (tierce mineure) ancré sur `base` 15,
 * arrondi au pixel entier : 15 ×1,2 → 18 → 22 → 26 → 31 → 38 ; ÷1,2 → 13 →
 * 11 (xs, labels) → 10 (micro, plancher absolu : rien en dessous).
 */
export const fontSize = {
  micro: 10,
  xs: 11,
  sm: 13,
  base: 15,
  md: 18,
  lg: 22,
  xl: 26,
  xxl: 31,
  display: 38,
} as const;

/**
 * Élévation « Canopée » : ombres diffuses, décalage vertical uniquement,
 * opacité basse (jamais de contour dur). En sombre, `elevation` Android reste
 * utile ; sur iOS la hiérarchie vient surtout des paliers de surface.
 * low = cartes au repos · mid = éléments flottants (FAB, hint) ·
 * high = sheets / surfaces au-dessus d'un scrim.
 */
export const shadows = {
  low: {
    shadowColor: '#141A15',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mid: {
    shadowColor: '#141A15',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  high: {
    shadowColor: '#141A15',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
} as const;

/** Largeur de bordure structurelle (hairline visuelle). */
export const borderWidth = 1;

/** Couleur-signal d'une personne (genre / statut) — avatars, nœuds d'arbre.
 *  Fixed across both themes: used for FILLS/rings (avatar tint, tree dot),
 *  where WCAG 1.4.11's 3:1 non-text threshold applies and these colours
 *  already clear it against every surface tone in use. */
export function getRoleColor(person: {
  gender?: string;
  isAlive?: boolean;
}): string {
  if (person.isAlive === false) return colors.deceased;
  if (person.gender === 'male') return colors.male;
  if (person.gender === 'female') return colors.female;
  return colors.unknown;
}

// Lightened (mixed 35% toward white) role colours for TEXT drawn on a dark
// surface — `colors.male/female/deceased/unknown` were fixed across both
// themes and only cleared ~3.3:1 as small (11pt) TEXT on dark backgrounds
// (Badge.tsx tonal chip, Avatar.tsx initials), below the 4.5:1 AA floor
// (AUDIT-V5 P1 #17). Verified via WCAG relative-luminance: ≥5.3:1 against
// both `darkPalette.bgCard` (#1D221D) and `.bgMuted` (#272D27).
const DARK_ROLE_TEXT = {
  male: '#84A3BD',
  female: '#C694A7',
  deceased: '#A9A59D',
  unknown: '#AAA69C',
} as const;

/** Same signal as `getRoleColor`, but scheme-aware and meant for TEXT
 *  (Badge labels, avatar initials) — pass the active `scheme` from
 *  `useTheme()`. Light theme reuses `getRoleColor` unchanged (already ≥4.5:1
 *  on light surfaces). */
export function roleTextColor(person: { gender?: string; isAlive?: boolean }, scheme: ThemeName): string {
  if (scheme === 'light') return getRoleColor(person);
  if (person.isAlive === false) return DARK_ROLE_TEXT.deceased;
  if (person.gender === 'male') return DARK_ROLE_TEXT.male;
  if (person.gender === 'female') return DARK_ROLE_TEXT.female;
  return DARK_ROLE_TEXT.unknown;
}
