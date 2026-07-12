import { G, Rect, Circle, Text as SvgText } from 'react-native-svg';
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
  /** Couleurs de surface + d'encre pour honorer le thème actif. */
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
}

/**
 * Nœud d'arbre Canopée (SVG, tappable) — carte arrondie, pastille-signal de
 * genre/statut à gauche du prénom, racine soulignée à l'accent (double trait).
 */
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

  return (
    <G onPress={() => onPress?.(person)}>
      <Rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill={surface}
        stroke={isRoot ? accent : faint}
        strokeWidth={isRoot ? 2 : 1}
        strokeOpacity={isRoot ? 1 : 0.55}
      />
      {/* Pastille-signal — genre / statut */}
      <Circle cx={x + 15} cy={y + 20} r={4.5} fill={spine} />

      <SvgText
        x={x + 26}
        y={y + 24}
        fontSize={12}
        fontWeight="700"
        fill={ink}
      >
        {truncate(person.firstName, 12)}
      </SvgText>
      <SvgText x={x + 15} y={y + 40} fontSize={11} fill={muted}>
        {truncate(person.lastName, 16)}
      </SvgText>
      {person.birthDate ? (
        <SvgText x={x + 15} y={y + 56} fontSize={9} fill={faint}>
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
