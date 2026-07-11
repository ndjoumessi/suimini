import { Person } from '@/types';

/* Shared node palette so FocusTree, TreeNode and TreeView render persons
 * identically. Gender is carried by the tinted face + bright left bar; the name
 * itself stays cream (#F5F0E8) for maximum legibility on the dark tint — the
 * coloured-name variant failed the contrast bar. The pivot/founder reads gold;
 * a spouse in the Focus couple reads gold (conjugal link, paired with the
 * diamond connector). Surname is muted (#9094A6), dates gold — set by the
 * rendering components, not here. */

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
  pivot: '#C9A84C',
} as const;

const STYLES = {
  male:    { bg: '#1A2235', bar: GENDER_BAR.male,    name: '#F5F0E8' },
  female:  { bg: '#251828', bar: GENDER_BAR.female,  name: '#F5F0E8' },
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
