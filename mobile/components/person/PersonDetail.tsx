import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { fonts, fontSize, spacing, getRoleColor } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Person, Relationship } from '@/lib/types';
import {
  getFullName,
  formatDate,
  getAge,
  formatAge,
  getParents,
  getSpouses,
  getSiblings,
  getChildren,
  personCompleteness,
} from '@/lib/treeUtils';

interface PersonDetailProps {
  person: Person;
  persons: Person[];
  relationships: Relationship[];
  onSelectRelative?: (id: string) => void;
}

export function PersonDetail({
  person,
  persons,
  relationships,
  onSelectRelative,
}: PersonDetailProps) {
  const { colors } = useTheme();
  const tint = getRoleColor(person);
  const age = getAge(person.birthDate, person.deathDate);

  const parents = getParents(person.id, relationships, persons);
  const spouses = getSpouses(person.id, relationships, persons);
  const siblings = getSiblings(person.id, relationships, persons);
  const children = getChildren(person.id, relationships, persons);
  const completeness = personCompleteness(person);

  return (
    <View style={styles.wrap}>
      {/* Hero */}
      <View style={styles.hero}>
        <Avatar person={person} size={96} />
        <Text style={[styles.name, { color: colors.text }]}>
          {getFullName(person)}
        </Text>
        <View style={styles.badges}>
          <Badge
            label={person.isAlive ? 'Vivant·e' : 'Décédé·e'}
            color={person.isAlive ? colors.accent : colors.textMuted}
          />
          {person.gender !== 'unknown' ? (
            <Badge
              label={person.gender === 'male' ? 'Homme' : person.gender === 'female' ? 'Femme' : 'Autre'}
              color={tint}
            />
          ) : null}
        </View>
      </View>

      {/* Vital info */}
      <Section title="Repères" colors={colors}>
        {person.birthDate ? (
          <InfoRow
            label="Naissance"
            value={`${formatDate(person.birthDate, person.birthDateApprox)}${
              person.birthPlace?.city ? ` · ${person.birthPlace.city}` : ''
            }`}
            colors={colors}
          />
        ) : null}
        {!person.isAlive && person.deathDate ? (
          <InfoRow
            label="Décès"
            value={`${formatDate(person.deathDate, person.deathDateApprox)}${
              person.deathPlace?.city ? ` · ${person.deathPlace.city}` : ''
            }`}
            colors={colors}
          />
        ) : null}
        {age != null ? (
          <InfoRow
            label={person.isAlive ? 'Âge' : 'A vécu'}
            value={formatAge(age)}
            colors={colors}
          />
        ) : null}
        {person.occupation ? (
          <InfoRow label="Profession" value={person.occupation} colors={colors} />
        ) : null}
        {person.nationality ? (
          <InfoRow label="Nationalité" value={person.nationality} colors={colors} />
        ) : null}
      </Section>

      {/* Completeness */}
      <View style={styles.completeRow}>
        <Text style={[styles.completeLabel, { color: colors.textMuted }]}>
          FICHE COMPLÉTÉE
        </Text>
        <View style={[styles.bar, { backgroundColor: colors.bgMuted }]}>
          <View
            style={[
              styles.barFill,
              { width: `${completeness}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
        <Text style={[styles.completePct, { color: colors.accent }]}>
          {completeness}%
        </Text>
      </View>

      {/* Bio */}
      {person.bio ? (
        <Section title="Biographie" colors={colors}>
          <Text style={[styles.bio, { color: colors.text }]}>{person.bio}</Text>
        </Section>
      ) : null}

      {/* Family */}
      {parents.length + spouses.length + siblings.length + children.length > 0 ? (
        <Section title="Famille" colors={colors}>
          <RelativeGroup title="Parents" people={parents} onSelect={onSelectRelative} colors={colors} />
          <RelativeGroup title="Conjoint·e·s" people={spouses} onSelect={onSelectRelative} colors={colors} />
          <RelativeGroup title="Fratrie" people={siblings} onSelect={onSelectRelative} colors={colors} />
          <RelativeGroup title="Enfants" people={children} onSelect={onSelectRelative} colors={colors} />
        </Section>
      ) : null}

      {/* DNA origins */}
      {person.dnaOrigins && person.dnaOrigins.length ? (
        <Section title="Origines ADN" colors={colors}>
          {person.dnaOrigins.map((o) => (
            <View key={o.region} style={styles.dnaRow}>
              <Text style={[styles.dnaLabel, { color: colors.text }]} numberOfLines={1}>
                {o.region}
              </Text>
              <View style={[styles.bar, styles.dnaBar, { backgroundColor: colors.bgMuted }]}>
                <View
                  style={[styles.barFill, { width: `${o.percent}%`, backgroundColor: tint }]}
                />
              </View>
              <Text style={[styles.dnaPct, { color: colors.textMuted }]}>{o.percent}%</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Tags */}
      {person.tags && person.tags.length ? (
        <View style={styles.tags}>
          {person.tags.map((t) => (
            <Badge key={t} label={t} color={colors.textMuted} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.accent }]}>
        {title.toUpperCase()}
      </Text>
      <Card elevated>{children}</Card>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textLight }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function RelativeGroup({
  title,
  people,
  onSelect,
  colors,
}: {
  title: string;
  people: Person[];
  onSelect?: (id: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  if (!people.length) return null;
  return (
    <View style={styles.relGroup}>
      <Text style={[styles.relTitle, { color: colors.textLight }]}>{title}</Text>
      {people.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.relRow}
          activeOpacity={0.7}
          onPress={() => onSelect?.(p.id)}
        >
          <Avatar person={p} size={36} />
          <Text style={[styles.relName, { color: colors.text }]} numberOfLines={1}>
            {p.firstName} {p.lastName}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  badges: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.md,
  },
  infoLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  infoValue: { fontFamily: fonts.body, fontSize: fontSize.base, flexShrink: 1, textAlign: 'right' },
  bio: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 24 },
  completeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  completeLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 1 },
  completePct: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  bar: { flex: 1, height: 8, overflow: 'hidden' },
  barFill: { height: '100%' },
  dnaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  dnaLabel: { fontFamily: fonts.body, fontSize: fontSize.sm, width: 130 },
  dnaBar: { flex: 1 },
  dnaPct: { fontFamily: fonts.mono, fontSize: fontSize.xs, width: 40, textAlign: 'right' },
  relGroup: { gap: spacing.xs, marginBottom: spacing.sm },
  relTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 0.5, marginTop: spacing.xs },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  relName: { fontFamily: fonts.body, fontSize: fontSize.base },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
