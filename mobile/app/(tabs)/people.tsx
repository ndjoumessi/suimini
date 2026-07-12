import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Keyboard,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Users, Plus } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { PersonCard } from '@/components/person/PersonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing, shadows, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { searchPersons, getGeneration } from '@/lib/treeUtils';
import type { Person } from '@/lib/types';

type SortKey = 'name' | 'date' | 'gen';
const PAGE = 50;

export default function PeopleScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { persons, relationships, refreshFromRemote } = useFamilyStore();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  // The FAB is `position: absolute; bottom: …` inside the screen's flex:1
  // root. On Android, focusing the search input resizes that root (default
  // `adjustResize` soft-input mode) — its bottom edge jumps up to make room
  // for the keyboard, and an absolute-bottom child follows it, landing mid-list
  // instead of staying pinned near the tab bar. Fading the FAB out for the
  // duration the keyboard is up sidesteps the jump entirely (the search field
  // is the relevant action while typing anyway).
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fabOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      Animated.timing(fabOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.timing(fabOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [fabOpacity]);

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
      <Header eyebrow={t('nav.people')} title={t('people.title')} subtitle={t('people.count', { count: filtered.length })} />

      <View style={styles.controls}>
        <Input
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setLimit(PAGE);
          }}
          placeholder={t('people.search')}
          autoCapitalize="none"
          style={{ paddingLeft: 40 }}
        />
        <Search size={18} color={colors.textLight} style={styles.searchIcon} />
      </View>

      <View style={styles.sortRow}>
        {(['name', 'date', 'gen'] as SortKey[]).map((key) => {
          const active = sort === key;
          const label =
            key === 'name'
              ? t('people.sortName')
              : key === 'date'
                ? t('people.sortBirth')
                : t('people.sortGen');
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSort(key)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
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
            title={t('people.noResult')}
            description={query ? t('people.noMatch', { query }) : t('people.emptyTree')}
          />
        }
      />

      {/* FAB — nouvelle fiche (masqué pendant la saisie, voir keyboardVisible ci-dessus) */}
      <Animated.View
        pointerEvents={keyboardVisible ? 'none' : 'auto'}
        style={[
          styles.fab,
          { backgroundColor: colors.accent, borderColor: colors.borderStrong, bottom: spacing.lg },
          shadows.hard,
          { opacity: fabOpacity, transform: [{ scale: fabOpacity }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/person/edit')}
          style={styles.fabTouch}
        >
          <Plus size={26} color={colors.bg} />
        </TouchableOpacity>
      </Animated.View>
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + 56 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderWidth,
  },
  fabTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
