import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TreePine } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { TreeView } from '@/components/tree/TreeView';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import type { Person } from '@/lib/types';

export default function TreeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeTree, persons, relationships } = useFamilyStore();

  const onSelect = (person: Person) =>
    router.push({ pathname: '/person/[id]', params: { id: person.id } });

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Header
        eyebrow="Arbre"
        title={activeTree?.name ?? 'Arbre'}
        subtitle={`${persons.length} personnes · pincez pour zoomer`}
      />
      {persons.length === 0 ? (
        <EmptyState
          icon={<TreePine size={32} color={colors.accent} />}
          title="Arbre vide"
          description="Ajoutez des personnes depuis le web pour voir l'arbre se dessiner."
        />
      ) : (
        <>
          <TreeView
            persons={persons}
            relationships={relationships}
            rootPersonId={activeTree?.rootPersonId}
            onSelect={onSelect}
          />
          <View style={[styles.hint, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Glissez pour explorer · pincez pour zoomer · touchez une fiche
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hintText: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, textAlign: 'center', letterSpacing: 0.5 },
});
