import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { fonts, fontSize, spacing, radius, shadows } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Bouton Canopée — pilule pleine (primary), tonale (secondary) ou texte
 * (ghost). L'état pressé assombrit/opacifie la surface (pas de scale brutal),
 * l'état disabled descend à 45 % d'opacité. Hauteur ≥ 48 pt (cible tactile).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  const fg = isPrimary ? colors.onAccent : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={isGhost ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        isPrimary && [
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
          !disabled && !loading && shadows.low,
        ],
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.bgMuted : colors.accentLight,
        },
        isGhost && [styles.ghost, pressed && { opacity: 0.6 }],
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingVertical: spacing.smd,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  ghost: { paddingVertical: spacing.sm, minHeight: 40 },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    letterSpacing: 0.2,
  },
});

export { ButtonProps };
