/**
 * Suimini design tokens — single source of truth for spacing, radii, type scale,
 * shadows, z-index and motion. Mirrors the CSS custom properties in globals.css.
 */

export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48, 16: 64,
} as const;

export const radius = {
  sm: 0, md: 2, lg: 4, xl: 6, full: 9999,
} as const;

export const fontSize = {
  xs: 11, sm: 12, base: 14, md: 16, lg: 18, xl: 24, '2xl': 32, '3xl': 48,
} as const;

export const fontWeight = {
  light: 300, regular: 400, medium: 500, bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2, snug: 1.4, normal: 1.6, relaxed: 1.8,
} as const;

/* Hard-offset shadows: flat at rest, the offset answers state (Atelier). */
export const shadow = {
  sm: '2px 2px 0 rgba(27,22,18,0.16)',
  md: '4px 4px 0 rgba(27,22,18,0.9)',
  lg: '6px 6px 0 rgba(27,22,18,0.9)',
  xl: '10px 10px 0 rgba(27,22,18,0.9)',
} as const;

export const zIndex = {
  base: 0, dropdown: 100, sticky: 200, overlay: 900, modal: 1000, toast: 9999,
} as const;

export const transition = {
  fast: 150, base: 200, slow: 300,
} as const;

export const easing = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/** Standard icon sizing used across the app (Lucide `size` prop). */
export const iconSize = {
  sm: 14, md: 16, lg: 18, xl: 22,
} as const;

/** Minimum touch target per WCAG 2.5.5 / Apple HIG. */
export const TOUCH_TARGET = 44;
