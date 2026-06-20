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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Smartphone, LogOut, Check, RefreshCw, Bell } from 'lucide-react-native';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import {
  registerForPushNotifications,
  savePushToken,
  disablePush,
  getStoredPushToken,
  isPushEnabled,
  getPushPermissionStatus,
  type PushPermission,
} from '@/lib/notifications';

const SYNC_LABEL: Record<string, string> = {
  idle: 'Prêt',
  saved: 'Synchronisé',
  syncing: 'Synchronisation…',
  offline: 'Hors-ligne (local)',
  error: 'Erreur de sync',
};

export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isDemo, signOut, configured, session } = useAuth();
  const { trees, activeTreeId, setActiveTree, syncStatus, refreshFromRemote } = useFamilyStore();

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
    { key: 'system', label: 'Système', icon: <Smartphone size={18} color={colors.text} /> },
    { key: 'light', label: 'Clair', icon: <Sun size={18} color={colors.text} /> },
    { key: 'dark', label: 'Sombre', icon: <Moon size={18} color={colors.text} /> },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xxl }}
    >
      <Header eyebrow="Réglages" title="Paramètres" />

      {/* Account */}
      <Section title="Compte" colors={colors}>
        <Card>
          <Text style={[styles.value, { color: colors.text }]}>
            {isDemo ? 'Mode démo' : user?.email ?? 'Non connecté'}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {isDemo
              ? 'Données locales (arbre Famille Dupont).'
              : configured
                ? 'Connecté via Supabase.'
                : 'Supabase non configuré.'}
          </Text>
        </Card>
      </Section>

      {/* Theme */}
      <Section title="Apparence" colors={colors}>
        <View style={styles.themeRow}>
          {themeOptions.map((opt) => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                activeOpacity={0.8}
                style={[
                  styles.themeChip,
                  {
                    borderColor: active ? colors.accent : colors.borderStrong,
                    backgroundColor: active ? colors.accentLight : colors.bgCard,
                  },
                ]}
              >
                {opt.icon}
                <Text style={[styles.themeLabel, { color: colors.text }]}>{opt.label}</Text>
                {active ? <Check size={14} color={colors.accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* Trees */}
      {trees.length > 1 ? (
        <Section title="Arbres" colors={colors}>
          {trees.map((t) => {
            const active = t.id === activeTreeId;
            return (
              <Card key={t.id} onPress={() => setActiveTree(t.id)} style={styles.treeItem}>
                <View style={styles.treeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.value, { color: colors.text }]}>{t.name}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {t.persons.length} personnes
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
      <Section title="Synchronisation" colors={colors}>
        <Card>
          <View style={styles.syncRow}>
            <Text style={[styles.value, { color: colors.text }]}>
              {SYNC_LABEL[syncStatus] ?? syncStatus}
            </Text>
            <TouchableOpacity onPress={() => refreshFromRemote()} disabled={!configured}>
              <RefreshCw size={18} color={configured ? colors.accent : colors.textLight} />
            </TouchableOpacity>
          </View>
        </Card>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" colors={colors}>
        <Card>
          <View style={styles.notifRow}>
            <View style={styles.notifLeft}>
              <Bell size={18} color={pushOn ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: colors.text }]}>
                  Notifications push
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {isDemo
                    ? 'Indisponible en mode démo.'
                    : pushPerm === 'denied'
                      ? 'Autorisation refusée — activez-la dans les réglages système.'
                      : pushOn && pushToken
                        ? `Activées · token ${pushToken.slice(0, 14)}…`
                        : 'Anniversaires et activité de la famille.'}
                </Text>
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
          label={isDemo ? 'Quitter la démo' : 'Se déconnecter'}
          variant="secondary"
          icon={<LogOut size={16} color={colors.text} />}
          onPress={onSignOut}
        />
        <Text style={[styles.version, { color: colors.textLight }]}>
          Suimini Mobile v1.0.0 · Design « Atelier »
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
      <Text style={[styles.sectionTitle, { color: colors.accent }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  value: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  meta: { fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: 2 },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeChip: {
    flex: 1,
    borderWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  themeLabel: { fontFamily: fonts.body, fontSize: fontSize.sm },
  treeItem: { marginBottom: spacing.xs },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  notifLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  footer: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  version: { fontFamily: fonts.mono, fontSize: fontSize.xs, textAlign: 'center' },
});
