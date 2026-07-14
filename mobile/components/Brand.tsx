import Svg, { Rect, G, Path } from 'react-native-svg';

/**
 * Suimini brand mark — mobile companion to the web app's `src/components/Brand.tsx`
 * (redesign 2026-07-14, « sceau du registre »). Same geometry — a rounded square
 * rotated 45° into a seal/diamond, enclosing a family-tree glyph whose nodes are
 * themselves small diamonds — kept in exact sync with the web SVG so the mark reads
 * identically on both platforms. Colors are NOT shared: mobile stays on its own
 * "Canopée" palette (warm paper + forest green, see `lib/theme.ts`), never the
 * web's Marine Deep navy — pass the resolved theme colors in explicitly, there's
 * no `currentColor`/CSS var equivalent in React Native.
 */
export function BrandMark({
  size = 28,
  color,
  accent,
  surface,
}: {
  size?: number;
  /** Frame stroke + connectors + child nodes. */
  color: string;
  /** Parent (root) node fill. */
  accent: string;
  /** Frame fill. */
  surface: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* frame — a rounded square rotated 45° into a seal/diamond */}
      <Rect x="6.3" y="6.3" width="19.4" height="19.4" rx="4" ry="4" fill={surface} stroke={color} strokeWidth="2.6" transform="rotate(45 16 16)" />
      {/* connectors */}
      <G stroke={color} strokeWidth="2" strokeLinecap="round">
        <Path d="M16 12 V18" />
        <Path d="M10.5 18 H21.5" />
        <Path d="M10.5 18 V21" />
        <Path d="M21.5 18 V21" />
      </G>
      {/* parent node (diamond) */}
      <Rect x="13.4" y="9.4" width="5.2" height="5.2" rx="1.3" ry="1.3" fill={accent} stroke={color} strokeWidth="1.4" transform="rotate(45 16 12)" />
      {/* child nodes (diamond) */}
      <Rect x="8.2" y="18.7" width="4.6" height="4.6" rx="1.15" ry="1.15" fill={color} transform="rotate(45 10.5 21)" />
      <Rect x="19.2" y="18.7" width="4.6" height="4.6" rx="1.15" ry="1.15" fill={color} transform="rotate(45 21.5 21)" />
    </Svg>
  );
}

export default BrandMark;
