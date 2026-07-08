import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { PersonDetail } from '@/components/person/PersonDetail';
import { RelationsSection } from '@/components/person/RelationsSection';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';

export default function PersonScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { persons, relationships, getPerson } = useFamilyStore();

  const person = id ? getPerson(id) : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {/* Top bar */}
      <View
        style={[
          styles.topbar,
          { paddingTop: insets.top + spacing.xs, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textMuted }]}>{t('person.sheet')}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            person && router.push({ pathname: '/person/edit', params: { id: person.id } })
          }
          disabled={!person}
        >
          <Pencil size={18} color={person ? colors.accent : colors.textLight} />
        </TouchableOpacity>
      </View>

      {person ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
          <PersonDetail
            person={person}
            persons={persons}
            relationships={relationships}
            onSelectRelative={(rid) =>
              router.push({ pathname: '/person/[id]', params: { id: rid } })
            }
          />
          <View style={styles.relations}>
            <RelationsSection person={person} />
          </View>
        </ScrollView>
      ) : (
        <EmptyState
          title={t('person.notFound')}
          description={t('person.notFoundDesc')}
          ctaLabel={t('common.back')}
          onCta={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: borderWidth,
  },
  iconBtn: { padding: spacing.xs, minWidth: 36 },
  topTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 2 },
  relations: { paddingHorizontal: spacing.lg, paddingTop: 0 },
});
