import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Smartphone, LogOut, Check, RefreshCw, Bell, Globe } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fonts, fontSize, spacing, radius } from '@/lib/theme';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { changeLanguage, currentLanguage, type Lang } from '@/lib/i18n';
import {
  registerForPushNotifications,
  savePushToken,
  disablePush,
  getStoredPushToken,
  isPushEnabled,
  getPushPermissionStatus,
  type PushPermission,
} from '@/lib/notifications';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isDemo, signOut, configured, session } = useAuth();
  const { trees, activeTreeId, setActiveTree, syncStatus, refreshFromRemote } = useFamilyStore();

  // Language (persisted via i18n).
  const [lang, setLang] = useState<Lang>(currentLanguage());
  const onLanguage = useCallback((next: Lang) => {
    changeLanguage(next).then(() => setLang(next));
  }, []);

  // Push notifications state.
  const [pushOn, setPushOn] = useState(false);
  const [pushPerm, setPushPerm] = useState<PushPermission>('undetermined');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPushOn(isPushEnabled());
    setPushToken(getStoredPushToken());
    getPushPermissionStatus().then(setPushPerm);
  }, []);

  const togglePush = useCallback(
    async (next: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      try {
        if (next) {
          const token = await registerForPushNotifications();
          setPushPerm(await getPushPermissionStatus());
          if (token) {
            setPushToken(token);
            setPushOn(true);
            const at = session?.access_token;
            if (at) await savePushToken(token, at);
          } else {
            setPushOn(false); // permission refusée / pas de projectId EAS
          }
        } else {
          disablePush();
          setPushToken(null);
          setPushOn(false);
        }
      } finally {
        setPushBusy(false);
      }
    },
    [pushBusy, session?.access_token],
  );

  const onSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const themeOptions: { key: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { key: 'system', label: t('settings.system'), icon: <Smartphone size={18} color={colors.text} /> },
    { key: 'light', label: t('settings.light'), icon: <Sun size={18} color={colors.text} /> },
    { key: 'dark', label: t('settings.dark'), icon: <Moon size={18} color={colors.text} /> },
  ];

  const langOptions: { key: Lang; label: string }[] = [
    { key: 'fr', label: 'Français' },
    { key: 'en', label: 'English' },
  ];

  const pushMeta = isDemo
    ? t('settings.pushDemo')
    : pushPerm === 'denied'
      ? t('settings.pushDenied')
      : pushOn && pushToken
        ? t('settings.pushOn', { token: pushToken.slice(0, 14) })
        : t('settings.pushDefault');

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xxl }}
    >
      <Header eyebrow={t('settings.eyebrow')} title={t('settings.title')} />

      {/* Account */}
      <Section title={t('settings.account')} colors={colors}>
        <Card>
          <Text style={[styles.value, { color: colors.text }]}>
            {isDemo ? t('settings.demoMode') : user?.email ?? t('settings.notConnected')}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {isDemo
              ? t('settings.localData')
              : configured
                ? t('settings.connected')
                : t('settings.supabaseMissing')}
          </Text>
        </Card>
      </Section>

      {/* Theme */}
      <Section title={t('settings.appearance')} colors={colors}>
        <View style={styles.chipRow}>
          {themeOptions.map((opt) => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accentLight : colors.bgCard,
                  },
                ]}
              >
                {opt.icon}
                <Text style={[styles.chipLabel, { color: colors.text }]}>{opt.label}</Text>
                {active ? <Check size={14} color={colors.accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* Language */}
      <Section title={t('settings.language')} colors={colors}>
        <View style={styles.chipRow}>
          {langOptions.map((opt) => {
            const active = lang === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onLanguage(opt.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accentLight : colors.bgCard,
                  },
                ]}
              >
                <Globe size={18} color={colors.text} />
                <Text style={[styles.chipLabel, { color: colors.text }]}>{opt.label}</Text>
                {active ? <Check size={14} color={colors.accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* Trees */}
      {trees.length > 1 ? (
        <Section title={t('settings.trees')} colors={colors}>
          {trees.map((tree) => {
            const active = tree.id === activeTreeId;
            return (
              <Card key={tree.id} onPress={() => setActiveTree(tree.id)} style={styles.treeItem}>
                <View style={styles.treeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.value, { color: colors.text }]}>{tree.name}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {t('settings.personsCount', { count: tree.persons.length })}
                    </Text>
                  </View>
                  {active ? <Check size={20} color={colors.accent} /> : null}
                </View>
              </Card>
            );
          })}
        </Section>
      ) : null}

      {/* Sync */}
      <Section title={t('settings.sync')} colors={colors}>
        <Card>
          <View style={styles.syncRow}>
            <Text style={[styles.value, { color: colors.text }]}>
              {t(`settings.syncStatus.${syncStatus}`, { defaultValue: syncStatus })}
            </Text>
            <TouchableOpacity
              onPress={() => refreshFromRemote()}
              disabled={!configured}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={t('settings.sync')}
            >
              <RefreshCw size={18} color={configured ? colors.accent : colors.textLight} />
            </TouchableOpacity>
          </View>
        </Card>
      </Section>

      {/* Notifications */}
      <Section title={t('settings.notifications')} colors={colors}>
        <Card>
          <View style={styles.notifRow}>
            <View style={styles.notifLeft}>
              <Bell size={18} color={pushOn ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: colors.text }]}>
                  {t('settings.pushTitle')}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{pushMeta}</Text>
              </View>
            </View>
            <Switch
              value={pushOn}
              onValueChange={togglePush}
              disabled={isDemo || pushBusy || pushPerm === 'denied'}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.bgCard}
            />
          </View>
        </Card>
      </Section>

      {/* About + sign out */}
      <View style={styles.footer}>
        <Button
          label={isDemo ? t('settings.exitDemo') : t('settings.signOut')}
          variant="secondary"
          icon={<LogOut size={16} color={colors.text} />}
          onPress={onSignOut}
        />
        <Text style={[styles.version, { color: colors.textLight }]}>
          {t('settings.version')}
        </Text>
      </View>
    </ScrollView>
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
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, letterSpacing: 0.5 },
  value: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  meta: { fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 72,
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  treeItem: { marginBottom: spacing.xs },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  notifLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  footer: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  version: { fontFamily: fonts.mono, fontSize: fontSize.xs, textAlign: 'center' },
});
