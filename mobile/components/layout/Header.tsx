import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { StatusBanner } from '@/components/StatusBanner';

interface HeaderProps {
  /** Petit surtitre (overline) au-dessus du titre. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onRightPress?: () => void;
}

/**
 * En-tête d'écran Canopée — overline accent en Figtree Medium, grand titre
 * serif, sous-titre apaisé, slot droit optionnel (cible ≥ 44 pt via hitSlop).
 */
export function Header({ eyebrow, title, subtitle, right, onRightPress }: HeaderProps) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.textCol}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? (
          onRightPress ? (
            <Pressable
              onPress={onRightPress}
              hitSlop={10}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              {right}
            </Pressable>
          ) : (
            <View>{right}</View>
          )
        ) : null}
      </View>
      {/* Bannière d'incident Supabase — ne rend rien hors incident. */}
      <StatusBanner />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  textCol: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxl,
    lineHeight: fontSize.xxl + 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    marginTop: 2,
  },
});
