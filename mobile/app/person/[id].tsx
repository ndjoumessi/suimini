import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { PersonDetail } from '@/components/person/PersonDetail';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';

export default function PersonScreen() {
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
        <Text style={[styles.topTitle, { color: colors.textMuted }]}>FICHE</Text>
        <TouchableOpacity style={styles.iconBtn} disabled>
          <Share2 size={18} color={colors.textLight} />
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
        </ScrollView>
      ) : (
        <EmptyState
          title="Fiche introuvable"
          description="Cette personne n'existe plus dans l'arbre actif."
          ctaLabel="Retour"
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
});
