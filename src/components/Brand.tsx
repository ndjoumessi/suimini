import type { CSSProperties } from 'react';

/**
 * Atelier brand mark — a bordered square enclosing a minimal family-tree glyph
 * (one parent node branching to two children). Replaces the legacy 🌿 emoji.
 *
 * - `currentColor` drives the frame + connectors, so the mark inherits text
 *   colour (set `color` on a parent, or pass `color`).
 * - The parent node is painted with `accent` (defaults to the live --accent).
 */
export function BrandMark({
  size = 28,
  color,
  accent = 'var(--accent)',
  surface = 'var(--bg-card)',
  style,
}: {
  size?: number;
  color?: string;
  accent?: string;
  surface?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ color, display: 'block', flexShrink: 0, ...style }}
    >
      {/* frame */}
      <rect x="1.4" y="1.4" width="29.2" height="29.2" fill={surface} stroke="currentColor" strokeWidth="2.6" />
      {/* connectors */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="square">
        <path d="M16 10 V16" />
        <path d="M9 16 H23" />
        <path d="M9 16 V21" />
        <path d="M23 16 V21" />
      </g>
      {/* parent node */}
      <rect x="13" y="6.5" width="6" height="6" fill={accent} stroke="currentColor" strokeWidth="1.4" />
      {/* child nodes */}
      <rect x="6.2" y="20.5" width="5.6" height="5.6" fill="currentColor" />
      <rect x="20.2" y="20.5" width="5.6" height="5.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Full lockup: mark + "Suimini" wordmark in the display face.
 * `tone` picks sensible defaults for light vs dark surfaces.
 */
export function BrandLockup({
  size = 28,
  fontSize,
  color,
  accent,
  surface,
  wordColor,
  gap = 9,
  style,
}: {
  size?: number;
  fontSize?: number | string;
  color?: string;
  accent?: string;
  surface?: string;
  wordColor?: string;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, lineHeight: 1, ...style }}>
      <BrandMark size={size} color={color} accent={accent} surface={surface} />
      <span
        className="serif"
        style={{
          fontSize: fontSize ?? size * 0.78,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: wordColor ?? color,
        }}
      >
        Suimini
      </span>
    </span>
  );
}

export default BrandMark;
