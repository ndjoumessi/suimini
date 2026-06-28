import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TreePine, Users, Clock, Cake, ChevronRight } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { fonts, fontSize, spacing, shadows, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { getUpcomingAnniversaries, getDisplayName } from '@/lib/treeUtils';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isDemo } = useAuth();
  const { activeTree, persons, stats, refreshFromRemote } = useFamilyStore();
  const [refreshing, setRefreshing] = useState(false);

  // Real name if we have one; demo → "Invité·e"; otherwise null (greet without a name).
  const name =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    (isDemo ? t('home.guest') : null);

  const recent = useMemo(
    () =>
      [...persons]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 4),
    [persons],
  );

  const birthdays = useMemo(
    () => getUpcomingAnniversaries(persons, 31).filter((a) => a.type === 'birthday'),
    [persons],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFromRemote();
    setRefreshing(false);
  }, [refreshFromRemote]);

  if (!activeTree) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <EmptyState
          icon={<TreePine size={32} color={colors.accent} />}
          title={t('home.noTree')}
          description={t('home.noTreeDesc')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <Header
        eyebrow={name ? t('home.greeting') : undefined}
        title={name ?? t('home.greeting')}
        subtitle={activeTree.name}
      />

      {/* Active tree card */}
      <View style={styles.block}>
        <Card elevated>
          <Text style={[styles.label, { color: colors.accent }]}>{t('home.activeTree')}</Text>
          <Text style={[styles.treeName, { color: colors.text }]}>{activeTree.name}</Text>
          {activeTree.description ? (
            <Text style={[styles.treeDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {activeTree.description}
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Stats */}
      {stats ? (
        <View style={styles.statsGrid}>
          <Stat value={stats.totalPersons} label={t('home.stats.persons')} colors={colors} />
          <Stat value={stats.totalGenerations} label={t('home.stats.generations')} colors={colors} />
          <Stat value={stats.totalAlive} label={t('home.stats.alive')} colors={colors} />
          <Stat value={stats.totalEvents} label={t('home.stats.events')} colors={colors} />
        </View>
      ) : null}

      {/* Quick access */}
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('home.quickAccess')}</Text>
        <View style={styles.quickRow}>
          <Quick icon={<TreePine size={22} color={colors.text} />} label={t('nav.tree')} onPress={() => router.push('/(tabs)/tree')} colors={colors} />
          <Quick icon={<Users size={22} color={colors.text} />} label={t('nav.people')} onPress={() => router.push('/(tabs)/people')} colors={colors} />
          <Quick icon={<Clock size={22} color={colors.text} />} label={t('nav.timeline')} onPress={() => router.push('/(tabs)/timeline')} colors={colors} />
        </View>
      </View>

      {/* Birthdays */}
      {birthdays.length ? (
        <View style={styles.block}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            {t('home.birthdays')}
          </Text>
          {birthdays.slice(0, 5).map((a) => (
            <Card key={a.person.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: a.person.id } })} style={styles.bdayCard}>
              <View style={styles.bdayRow}>
                <Cake size={18} color={colors.accent} />
                <Text style={[styles.bdayName, { color: colors.text }]} numberOfLines={1}>
                  {getDisplayName(a.person)}
                </Text>
                <Text style={[styles.bdayDays, { color: colors.textMuted }]}>
                  {a.daysUntil === 0 ? t('home.today') : t('home.daysLeft', { count: a.daysUntil })}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Recent */}
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('home.recent')}
        </Text>
        {recent.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.recentRow, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })}
          >
            <Avatar person={p} size={40} />
            <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
              {getDisplayName(p)}
            </Text>
            <ChevronRight size={18} color={colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({
  value,
  label,
  colors,
}: {
  value: number;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }, shadows.hardSm]}>
      <Text style={[styles.statValue, { color: colors.accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Quick({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      style={[styles.quick, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 1.5 },
  treeName: { fontFamily: fonts.display, fontSize: fontSize.lg, marginTop: 2 },
  treeDesc: { fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  statValue: { fontFamily: fonts.display, fontSize: fontSize.xxl },
  statLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs - 2, letterSpacing: 1, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    borderWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  bdayCard: { marginTop: spacing.xs },
  bdayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bdayName: { fontFamily: fonts.body, fontSize: fontSize.base, flex: 1 },
  bdayDays: { fontFamily: fonts.mono, fontSize: fontSize.xs },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  recentName: { fontFamily: fonts.body, fontSize: fontSize.base, flex: 1 },
});
