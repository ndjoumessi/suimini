import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { spacing, shadows, radius, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  /** Ombre diffuse `low` (cartes mises en avant). */
  elevated?: boolean;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
}

/**
 * Carte Canopée — surface arrondie (radius.md), bordure hairline, ombre
 * diffuse optionnelle. Pressée : la surface glisse vers bgMuted.
 */
export function Card({
  children,
  elevated,
  onPress,
  padded = true,
  style,
}: CardProps) {
  const { colors } = useTheme();

  const shell = (pressed: boolean): ViewStyle[] =>
    [
      styles.base,
      {
        backgroundColor: pressed ? colors.bgMuted : colors.bgCard,
        borderColor: colors.border,
      },
      padded ? styles.padded : null,
      elevated ? shadows.low : null,
      style,
    ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => shell(pressed)}>
        {children}
      </Pressable>
    );
  }
  return <View style={shell(false)}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  padded: { padding: spacing.md },
});
