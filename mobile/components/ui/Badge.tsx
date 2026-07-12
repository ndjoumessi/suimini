import { View, Text, StyleSheet } from 'react-native';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface BadgeProps {
  label: string;
  /** Optional explicit color (border + text). Defaults to ink. */
  color?: string;
  /** Filled variant: solid background, bone text. */
  filled?: boolean;
}

/** Mono, uppercase, hairline-bordered chip — the Atelier `.label` made physical. */
export function Badge({ label, color, filled }: BadgeProps) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  return (
    <View
      style={[
        styles.base,
        {
          borderColor: c,
          backgroundColor: filled ? c : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: filled ? colors.bgCard : c },
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
});
