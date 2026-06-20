import { G, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { Person } from '@/lib/types';
import { getRoleColor } from '@/lib/theme';
import { NODE_W, NODE_H } from '@/lib/treeLayout';

interface PersonNodeProps {
  person: Person;
  x: number;
  y: number;
  isRoot?: boolean;
  onPress?: (person: Person) => void;
  /** Surface + ink colors so the node honors the active theme. */
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
}

/** A single family-tree node rendered as SVG (tappable). */
export function PersonNode({
  person,
  x,
  y,
  isRoot,
  onPress,
  surface,
  ink,
  muted,
  faint,
  accent,
}: PersonNodeProps) {
  const { t } = useTranslation();
  const spine = getRoleColor(person);
  const stroke = isRoot ? accent : ink;

  return (
    <G onPress={() => onPress?.(person)}>
      <Rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        fill={surface}
        stroke={stroke}
        strokeWidth={isRoot ? 2.5 : 1.25}
      />
      {/* Left spine — gender / status signal */}
      <Rect x={x} y={y} width={5} height={NODE_H} fill={spine} />

      <SvgText
        x={x + 16}
        y={y + 24}
        fontSize={12}
        fontWeight="700"
        fill={ink}
      >
        {truncate(person.firstName, 14)}
      </SvgText>
      <SvgText x={x + 16} y={y + 40} fontSize={11} fill={muted}>
        {truncate(person.lastName, 16)}
      </SvgText>
      {person.birthDate ? (
        <SvgText x={x + 16} y={y + 56} fontSize={9} fill={faint}>
          {person.isAlive ? `${t('tree.born')} ` : '✝ '}
          {person.birthDate.slice(0, 4)}
          {!person.isAlive && person.deathDate
            ? `–${person.deathDate.slice(0, 4)}`
            : ''}
        </SvgText>
      ) : null}
    </G>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
