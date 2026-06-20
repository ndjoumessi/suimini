import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Users } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { PersonCard } from '@/components/person/PersonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { searchPersons, getGeneration } from '@/lib/treeUtils';
import type { Person } from '@/lib/types';

type SortKey = 'name' | 'date' | 'gen';
const PAGE = 50;

export default function PeopleScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { persons, relationships, refreshFromRemote } = useFamilyStore();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  const genMap = useMemo(() => {
    const memo = new Map<string, number>();
    persons.forEach((p) => getGeneration(p.id, relationships, persons, memo));
    return memo;
  }, [persons, relationships]);

  const filtered = useMemo(() => {
    const list = searchPersons(persons, query);
    const sorted = [...list].sort((a, b) => {
      if (sort === 'name')
        return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
      if (sort === 'date')
        return (a.birthDate ?? '9999').localeCompare(b.birthDate ?? '9999');
      return (genMap.get(a.id) ?? 0) - (genMap.get(b.id) ?? 0);
    });
    return sorted;
  }, [persons, query, sort, genMap]);

  const visible = filtered.slice(0, limit);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFromRemote();
    setRefreshing(false);
  }, [refreshFromRemote]);

  const renderItem = useCallback(
    ({ item }: { item: Person }) => (
      <PersonCard
        person={item}
        generation={genMap.get(item.id)}
        onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })}
      />
    ),
    [genMap, router],
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Header eyebrow="Famille" title="Personnes" subtitle={`${filtered.length} fiches`} />

      <View style={styles.controls}>
        <Input
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setLimit(PAGE);
          }}
          placeholder="Rechercher un nom, métier, ville…"
          autoCapitalize="none"
          style={{ paddingLeft: 40 }}
        />
        <Search size={18} color={colors.textLight} style={styles.searchIcon} />
      </View>

      <View style={styles.sortRow}>
        {(['name', 'date', 'gen'] as SortKey[]).map((key) => {
          const active = sort === key;
          const label = key === 'name' ? 'Nom' : key === 'date' ? 'Naissance' : 'Génération';
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSort(key)}
              style={[
                styles.sortChip,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentLight : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.sortText,
                  { color: active ? colors.accent : colors.textMuted },
                ]}
              >
                {label.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (limit < filtered.length) setLimit((l) => l + PAGE);
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={32} color={colors.accent} />}
            title="Aucun résultat"
            description={query ? `Rien ne correspond à « ${query} ».` : 'Aucune personne dans cet arbre.'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: spacing.lg + spacing.md, top: 14 },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sortChip: { borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  sortText: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 0.5 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
});
