import { Person } from '@/types';

/* Shared node palette so FocusTree, TreeNode and TreeView render persons
 * identically. Gender is carried by the tinted face + bright left bar; the name
 * itself stays high-contrast ink for maximum legibility on the tint — the
 * coloured-name variant failed the contrast bar. The pivot/founder reads gold;
 * a spouse in the Focus couple reads gold (conjugal link, paired with the
 * diamond connector). Surname is muted, dates gold — set by the
 * rendering components, not here.
 *
 * Two face palettes, DARK (the original "Veillée" tints) and LIGHT — picked
 * at call time via `currentNodeMode()`, which reads `<html data-theme>`
 * directly rather than threading a prop through FocusTree/TreeView/TreeNode
 * (nodeStyle() runs once per rendered PERSON, often dozens of times, so a
 * cheap synchronous attribute read beats plumbing new props down 2-3
 * component layers for something that only changes on a full view remount
 * anyway — switching theme happens on the separate Settings view, so the
 * tree always remounts fresh with the current attribute by the time it's
 * shown again). `bar` intentionally does NOT get a light variant: it must
 * keep matching `GENDER_BAR` (used unchanged, mode-independent, across
 * PersonAvatar/PersonCard/legends/etc. — see globals.css's light-theme
 * comment for the same invariant applied to the CSS `--male`/`--female`
 * vars). */

export interface NodeStyle {
  /** Node face background. */
  bg: string;
  /** Left bar colour (gender / role). */
  bar: string;
  /** Primary name colour, kept legible on `bg`. */
  name: string;
}

export const GENDER_BAR = {
  male: '#4A90D9',
  female: '#C47BA0',
  unknown: '#4a4033',
  pivot: '#C9A84C',
} as const;

// Retuned for the Marine Deep dark canvas (--bg #0f1a24): the old fills sat
// ~2-2.7x brighter than the old ember --bg, but the tree renders directly on
// --bg (TreeView's own background), so once --bg itself turned navy the old
// male fill (#1D2430, already blue-tinted) nearly vanished into the new
// canvas. New fills keep the same per-gender hue intent and are re-verified
// at an equal-or-better brightness multiple over the new --bg.
const DARK_STYLES = {
  male:    { bg: '#243A52', bar: GENDER_BAR.male,    name: '#F3ECDF' },
  female:  { bg: '#3A2534', bar: GENDER_BAR.female,  name: '#F3ECDF' },
  unknown: { bg: '#332C22', bar: GENDER_BAR.unknown, name: '#F3ECDF' },
  spouse:  { bg: '#332C22', bar: '#C9A84C',          name: '#F3ECDF' },
  pivot:   { bg: '#3D3218', bar: '#C9A84C',          name: '#F3ECDF' },
} as const satisfies Record<string, NodeStyle>;

// Same hues as DARK_STYLES, tinted light instead of dark; ink text instead of
// paper-cream. Contrast checked (ink #211B12 on every face): ≥13.8:1.
const LIGHT_STYLES = {
  male:    { bg: '#E3EDF8', bar: GENDER_BAR.male,    name: '#211B12' },
  female:  { bg: '#F7E8EF', bar: GENDER_BAR.female,  name: '#211B12' },
  unknown: { bg: '#EFE7D3', bar: GENDER_BAR.unknown, name: '#211B12' },
  spouse:  { bg: '#EFE7D3', bar: '#C9A84C',          name: '#211B12' },
  pivot:   { bg: '#F6E8C4', bar: '#C9A84C',          name: '#211B12' },
} as const satisfies Record<string, NodeStyle>;

/** Foreground for INITIALS/text drawn directly on a flat `GENDER_BAR` fill
 *  (avatars, legends) — distinct from `nodeStyle()`'s tree-face palette, which
 *  re-tints the FILL itself per light/dark theme. Here the fill is always the
 *  fixed `GENDER_BAR` colour (theme-independent), so the foreground must also
 *  be a fixed colour chosen for THAT exact fill. Using a theme-flipping token
 *  like `var(--ink)` here was the bug (AUDIT-V5 P0 #1 / P1 #5): on the
 *  "unknown" muted-brown fill, `--ink` flips to dark ink in light mode →
 *  near-black text on a near-black fill (1.7:1). Verified contrasts (WCAG,
 *  recomputed): male/female → dark ink 5.1-6.7:1 ; unknown → light cream
 *  8.6:1. Never use `var(--ink-on-accent)` for "unknown" — it was designed
 *  for the (bright) gold accent fill, not this dark brown one. */
export function avatarColors(gender: Person['gender']): { bg: string; fg: string } {
  if (gender === 'male') return { bg: GENDER_BAR.male, fg: '#171006' };
  if (gender === 'female') return { bg: GENDER_BAR.female, fg: '#171006' };
  return { bg: GENDER_BAR.unknown, fg: '#f3ecdf' };
}

/** Reads the active theme straight off <html> — see the module comment for
 *  why this beats prop-drilling here. SSR-safe (no `document` → 'dark'). */
export function currentNodeMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Resolve a person's node style. `isPivot` wins (founder); then `isSpouse`
 * (Focus couple partner); otherwise gender. Reads the current light/dark
 * mode itself unless the caller already knows it (pass `mode` to skip the
 * DOM read when rendering many nodes in the same pass — see TreeView.tsx). */
export function nodeStyle(p: Person, isPivot: boolean, isSpouse = false, mode?: 'light' | 'dark'): NodeStyle {
  const STYLES = (mode ?? currentNodeMode()) === 'light' ? LIGHT_STYLES : DARK_STYLES;
  if (isPivot) return STYLES.pivot;
  if (isSpouse) return STYLES.spouse;
  return p.gender === 'male' ? STYLES.male : p.gender === 'female' ? STYLES.female : STYLES.unknown;
}

/* Teintes muettes pour distinguer VISUELLEMENT chaque union d'une personne
 * polygame / remariée (connecteurs vers chaque groupe d'enfants + barre conjugale).
 * L'or accent reste l'union 0 (par défaut) ; les suivantes empruntent les familles
 * de teintes du système « Atelier » (bleu-gris, terracotta-muted, olive) — assez
 * distinctes pour lire l'appartenance, jamais criardes sur le fond sombre. */
const UNION_TINTS = ['#c9a84c', '#6e9aa6', '#b08a6e', '#8a9a6e', '#a67e9a'] as const;

/** Teinte de l'union d'indice `i` (cyclique). Utilisée UNIQUEMENT quand une
 *  personne a ≥ 2 unions ; sinon les composants gardent `var(--accent)`. */
export function unionTint(i: number): string {
  return UNION_TINTS[((i % UNION_TINTS.length) + UNION_TINTS.length) % UNION_TINTS.length];
}

/** Display lines for a node, robust to missing names (Bug 3).
 *  - first name present → primary = first name, secondary = last name (or none)
 *  - only last name      → primary = last name, no secondary
 *  - neither             → primary = unknownLabel */
export function nameLines(p: Person, unknownLabel: string): { primary: string; secondary: string | null } {
  const fn = (p.firstName || '').trim();
  const ln = (p.lastName || '').trim();
  if (fn) return { primary: fn, secondary: ln || null };
  if (ln) return { primary: ln, secondary: null };
  return { primary: unknownLabel, secondary: null };
}
