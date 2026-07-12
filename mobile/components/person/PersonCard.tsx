import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Person } from '@/lib/types';
import { getDisplayName, formatYear, getAge, formatAge } from '@/lib/treeUtils';

interface PersonCardProps {
  person: Person;
  onPress?: () => void;
  /** Optional generation index shown as a mono tag. */
  generation?: number;
}

export function PersonCard({ person, onPress, generation }: PersonCardProps) {
  const { colors } = useTheme();
  const birth = formatYear(person.birthDate);
  const death = formatYear(person.deathDate);
  const lifespan = person.isAlive
    ? birth
      ? `${birth} · ${formatAge(getAge(person.birthDate))}`
      : '—'
    : birth || death
      ? `${birth || '?'} – ${death || '?'}`
      : '—';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar person={person} size={52} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {getDisplayName(person)}
          </Text>
          {person.occupation ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {person.occupation}
            </Text>
          ) : null}
          <Text style={[styles.dates, { color: colors.textLight }]} numberOfLines={1}>
            {lifespan}
            {person.birthPlace?.city ? `  ·  ${person.birthPlace.city}` : ''}
          </Text>
        </View>
        {generation != null ? (
          <View style={[styles.genTag, { borderColor: colors.border }]}>
            <Text style={[styles.genText, { color: colors.textMuted }]}>
              G{generation}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.display, fontSize: fontSize.md },
  meta: { fontFamily: fonts.body, fontSize: fontSize.sm },
  dates: { fontFamily: fonts.mono, fontSize: fontSize.xs },
  genTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  genText: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
});
