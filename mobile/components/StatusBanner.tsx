/**
 * Slim dismissible Supabase-incident banner (mobile). Renders nothing when all
 * systems are operational. Mounted under the Header. Fail-open by construction.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertOctagon, X } from 'lucide-react-native';
import { fonts, fontSize, spacing, borderWidth, colors as tokens } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSupabaseStatus, bannerLevel, dismissKey } from '@/hooks/useSupabaseStatus';

const STATUS_URL = 'https://status.supabase.com';

/** Keys the user dismissed this session (in-memory; a new incident re-shows). */
const dismissedKeys = new Set<string>();

export function StatusBanner() {
  const status = useSupabaseStatus();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const key = dismissKey(status);
  const [dismissed, setDismissed] = useState(() => dismissedKeys.has(key));

  useEffect(() => {
    setDismissed(dismissedKeys.has(key));
  }, [key]);

  const level = bannerLevel(status.indicator);
  if (!level || dismissed) return null;

  const tone =
    level.tone === 'danger' ? colors.danger : level.tone === 'warning' ? tokens.warning : colors.accent;
  const Icon = level.level === 'critical' ? AlertOctagon : AlertTriangle;

  const dismiss = () => {
    dismissedKeys.add(key);
    setDismissed(true);
  };

  return (
    <View
      accessibilityRole={level.level === 'critical' ? 'alert' : 'summary'}
      style={[styles.wrap, { backgroundColor: colors.bgCard, borderColor: tone }]}
    >
      <Icon size={level.iconSize} color={tone} />
      <TouchableOpacity
        style={styles.textCol}
        activeOpacity={0.8}
        accessibilityRole="link"
        accessibilityHint={t('status.viewStatus')}
        onPress={() => Linking.openURL(STATUS_URL).catch(() => {})}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {t('status.bannerTitle')}
          {status.description ? ` · ${status.description}` : ''}
        </Text>
        <Text style={[styles.link, { color: tone }]}>{t('status.viewStatus')} →</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('status.dismiss')}
        hitSlop={8}
      >
        <X size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: borderWidth,
    borderBottomWidth: borderWidth,
  },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.mono, fontSize: fontSize.xs },
  link: { fontFamily: fonts.monoBold, fontSize: fontSize.xs, marginTop: 2 },
});
