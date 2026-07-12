import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TreePine } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { TreeView } from '@/components/tree/TreeView';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing, radius, shadows } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import type { Person } from '@/lib/types';

export default function TreeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeTree, persons, relationships } = useFamilyStore();

  const onSelect = (person: Person) =>
    router.push({ pathname: '/person/[id]', params: { id: person.id } });

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Header
        eyebrow={t('tree.title')}
        title={activeTree?.name ?? t('tree.title')}
        subtitle={t('tree.subtitle', { count: persons.length })}
      />
      {persons.length === 0 ? (
        <EmptyState
          icon={<TreePine size={32} color={colors.accent} />}
          title={t('tree.empty')}
          description={t('tree.emptyDesc')}
        />
      ) : (
        <>
          <TreeView
            persons={persons}
            relationships={relationships}
            rootPersonId={activeTree?.rootPersonId}
            onSelect={onSelect}
          />
          <View style={[styles.hint, shadows.mid, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              {t('tree.hint')}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hintText: { fontFamily: fonts.body, fontSize: fontSize.sm, textAlign: 'center' },
});
