import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { fonts, fontSize, spacing, shadows, borderWidth } from '@/lib/theme';
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

  const bg = isPrimary ? colors.accent : 'transparent';
  const border = isGhost ? 'transparent' : colors.borderStrong;
  const fg = isPrimary ? colors.bg : isGhost ? colors.accent : colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.base,
        { backgroundColor: bg, borderColor: border },
        isGhost && styles.ghost,
        isPrimary && shadows.hard,
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
  },
  ghost: { borderWidth: 0, paddingVertical: spacing.sm },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    letterSpacing: 0.3,
  },
});

export { ButtonProps };
