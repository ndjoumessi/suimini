'use client';
import { FamilyTree } from '@/types';

/* =====================================================================
   TreeAvatar — soft-cornered gold tile with the tree's initials in the
   display face (ink on gold), matching PersonAvatar's language but for
   trees. No placeholder icons. Up to two initials from the tree name.
   ===================================================================== */

function treeInitials(name?: string | null): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase().slice(0, 2);
}

export default function TreeAvatar({ tree, name, size = 40, style }: {
  tree?: FamilyTree;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--accent)', color: 'var(--ink-on-accent)',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: Math.round(size * 0.38), lineHeight: 1, letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {treeInitials(tree?.name ?? name)}
    </span>
  );
}
