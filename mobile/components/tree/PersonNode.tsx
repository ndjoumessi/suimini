import { PixelRatio } from 'react-native';
import { G, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { Person } from '@/lib/types';
import { getRoleColor } from '@/lib/theme';
import { NODE_W, NODE_H } from '@/lib/treeLayout';

// SVG text ignores the OS's font-scale setting by default — unlike RN's own
// <Text>, which honours it automatically (AUDIT-V5 P2 #38, Dynamic
// Type/font-scale insensitivity). Scaling every fontSize by the device's
// current factor restores that behaviour for someone who bumped their
// system text size for readability.
const fontScale = () => PixelRatio.getFontScale();

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
  const scale = fontScale();

  // Mirror of the web tree's aria-label (TreeView.tsx) — name, gender stated
  // in words (not just the colour dot), birth year when known. VoiceOver/
  // TalkBack otherwise see an unlabelled tappable shape (AUDIT-V5 P0 #3).
  const genderWord = person.gender === 'female' ? t('tree.genderF') : person.gender === 'male' ? t('tree.genderM') : '';
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim() || t('tree.unknownNode');
  const accessibilityLabel = `${name}${genderWord ? `, ${genderWord}` : ''}${person.birthDate ? `, ${t('tree.born')} ${person.birthDate.slice(0, 4)}` : ''}`;

  return (
    <G
      onPress={() => onPress?.(person)}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
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
        fontSize={12 * scale}
        fontWeight="700"
        fill={ink}
      >
        {truncate(person.firstName, 12)}
      </SvgText>
      <SvgText x={x + 15} y={y + 40} fontSize={11 * scale} fill={muted}>
        {truncate(person.lastName, 16)}
      </SvgText>
      {person.birthDate ? (
        <SvgText x={x + 15} y={y + 56} fontSize={9 * scale} fill={faint}>
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
