import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { StatusBanner } from '@/components/StatusBanner';

interface HeaderProps {
  /** Small mono uppercase eyebrow above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onRightPress?: () => void;
}

/** Editorial screen header — mono eyebrow, display title, optional right slot. */
export function Header({ eyebrow, title, subtitle, right, onRightPress }: HeaderProps) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.textCol}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {eyebrow.toUpperCase()}
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
            <TouchableOpacity onPress={onRightPress} activeOpacity={0.8}>
              {right}
            </TouchableOpacity>
          ) : (
            <View>{right}</View>
          )
        ) : null}
      </View>
      {/* Supabase incident banner — renders only during an active incident. */}
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
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxl,
    lineHeight: fontSize.xxl + 4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    marginTop: 2,
  },
});
