import type { CSSProperties } from 'react';

/**
 * Suimini brand mark — « sceau du registre » (redesign 2026-07-14, replacing
 * the bordered-square version this component predates). The frame is now a
 * rounded diamond — a square rotated 45°, like a wax seal or a hand-stamped
 * register mark — and the family-tree glyph inside it uses the same
 * diamond-node language as the landing hero's `LineageMark` (generation
 * marks read as small ink seals, not squares/stars). This unifies the app
 * icon and the landing's "manuscrit enluminé" scene under one visual idiom.
 * The glyph itself (one parent branching to two children) is unchanged in
 * concept — only its geometry moved from square to diamond, everywhere.
 *
 * - `currentColor` drives the frame + connectors, so the mark inherits text
 *   colour (set `color` on a parent, or pass `color`).
 * - The parent node is painted with `accent` (defaults to the live --accent).
 * - Connectors are drawn first and the diamond nodes painted on top, so line
 *   ends don't need to be trimmed to the rotated node edges (same technique
 *   as `LineageMark`).
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
      {/* frame — a rounded square rotated 45° into a seal/diamond */}
      <rect x="6.3" y="6.3" width="19.4" height="19.4" rx="4" ry="4" fill={surface} stroke="currentColor" strokeWidth="2.6" transform="rotate(45 16 16)" />
      {/* connectors */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 12 V18" />
        <path d="M10.5 18 H21.5" />
        <path d="M10.5 18 V21" />
        <path d="M21.5 18 V21" />
      </g>
      {/* parent node (diamond) */}
      <rect x="13.4" y="9.4" width="5.2" height="5.2" rx="1.3" ry="1.3" fill={accent} stroke="currentColor" strokeWidth="1.4" transform="rotate(45 16 12)" />
      {/* child nodes (diamond) */}
      <rect x="8.2" y="18.7" width="4.6" height="4.6" rx="1.15" ry="1.15" fill="currentColor" transform="rotate(45 10.5 21)" />
      <rect x="19.2" y="18.7" width="4.6" height="4.6" rx="1.15" ry="1.15" fill="currentColor" transform="rotate(45 21.5 21)" />
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
          letterSpacing: '-0.01em',
          color: wordColor ?? color,
        }}
      >
        Suimini
      </span>
    </span>
  );
}

export default BrandMark;
