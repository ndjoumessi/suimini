import { useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { getDisplayName, formatDate } from '@/lib/treeUtils';
import type { Person } from '@/lib/types';

interface TimelineItem {
  id: string;
  date: string;
  year: string;
  label: string;
  person: Person;
}

const EVENT_LABEL: Record<string, string> = {
  birth: 'Naissance',
  death: 'Décès',
  marriage: 'Mariage',
  divorce: 'Divorce',
  baptism: 'Baptême',
  graduation: 'Diplôme',
  military: 'Service',
  immigration: 'Immigration',
  other: 'Événement',
};

export default function TimelineScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { persons } = useFamilyStore();

  const sections = useMemo(() => {
    const items: TimelineItem[] = [];
    persons.forEach((p) => {
      const events = (
        p.events?.length
          ? p.events
          : [
              p.birthDate ? { id: `${p.id}-b`, type: 'birth', date: p.birthDate } : null,
              p.deathDate ? { id: `${p.id}-d`, type: 'death', date: p.deathDate } : null,
            ].filter(Boolean)
      ) as Array<{ id: string; type: string; date?: string; description?: string }>;
      events.forEach((e) => {
        if (!e.date) return;
        items.push({
          id: `${p.id}-${e.id}`,
          date: e.date,
          year: e.date.slice(0, 4),
          label: e.description || EVENT_LABEL[e.type] || 'Événement',
          person: p,
        });
      });
    });
    items.sort((a, b) => a.date.localeCompare(b.date));

    // Group by decade.
    const byDecade = new Map<string, TimelineItem[]>();
    items.forEach((it) => {
      const decade = `${it.year.slice(0, 3)}0s`;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      byDecade.get(decade)!.push(it);
    });
    return Array.from(byDecade.entries()).map(([title, data]) => ({ title, data }));
  }, [persons]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Header eyebrow="Chronologie" title="Au fil du temps" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={[styles.decadeWrap, { backgroundColor: colors.bg }]}>
            <Text style={[styles.decade, { color: colors.accent }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.person.id } })}
          >
            <View style={styles.spineCol}>
              <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.bg }]} />
              <View style={[styles.spine, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.content}>
              <Text style={[styles.date, { color: colors.textLight }]}>
                {formatDate(item.date)}
              </Text>
              <Text style={[styles.label, { color: colors.text }]}>
                {item.label} — <Text style={{ fontFamily: fonts.bodyBold }}>{getDisplayName(item.person)}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Clock size={32} color={colors.accent} />}
            title="Pas encore d'événements"
            description="Les naissances, mariages et autres jalons apparaîtront ici."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  decadeWrap: { paddingVertical: spacing.sm },
  decade: { fontFamily: fonts.mono, fontSize: fontSize.sm, letterSpacing: 1.5 },
  row: { flexDirection: 'row', gap: spacing.md },
  spineCol: { alignItems: 'center', width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  spine: { width: 2, flex: 1, marginTop: 2 },
  content: { flex: 1, paddingBottom: spacing.md },
  date: { fontFamily: fonts.mono, fontSize: fontSize.xs },
  label: { fontFamily: fonts.body, fontSize: fontSize.base, marginTop: 2, lineHeight: 22 },
});
