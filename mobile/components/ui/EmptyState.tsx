import { View, Text, StyleSheet } from 'react-native';
import { fonts, fontSize, spacing, radius } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/** État vide Canopée — pastille tonale, titre serif, description apaisée. */
export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: colors.accentLight }]}>
          {icon}
        </View>
      ) : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, { color: colors.textMuted }]}>
          {description}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  iconBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});
