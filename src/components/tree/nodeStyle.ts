import { Person } from '@/types';

/* Shared node palette so FocusTree, TreeNode and TreeView render persons
 * identically. Gender is the primary signal (tinted face + bright left bar +
 * legible name colour); the pivot/founder reads gold; a spouse in the Focus
 * couple reads gold (conjugal link, paired with the diamond connector). */

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
  unknown: '#3A3A4A',
} as const;

const STYLES = {
  male:    { bg: '#1A2235', bar: GENDER_BAR.male,    name: '#7EB5F0' },
  female:  { bg: '#251828', bar: GENDER_BAR.female,  name: '#E8A0C0' },
  unknown: { bg: '#1A1A28', bar: GENDER_BAR.unknown, name: '#F5F0E8' },
  spouse:  { bg: '#1A1A28', bar: '#C9A84C',          name: '#F5F0E8' },
  pivot:   { bg: '#2A2010', bar: '#C9A84C',          name: '#F5F0E8' },
} as const satisfies Record<string, NodeStyle>;

/** Resolve a person's node style. `isPivot` wins (founder); then `isSpouse`
 * (Focus couple partner); otherwise gender. */
export function nodeStyle(p: Person, isPivot: boolean, isSpouse = false): NodeStyle {
  if (isPivot) return STYLES.pivot;
  if (isSpouse) return STYLES.spouse;
  return p.gender === 'male' ? STYLES.male : p.gender === 'female' ? STYLES.female : STYLES.unknown;
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
