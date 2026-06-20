import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { spacing, shadows, borderWidth, radius } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  /** Hard ink offset shadow (Atelier signature). */
  elevated?: boolean;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
}

export function Card({
  children,
  elevated,
  onPress,
  padded = true,
  style,
}: CardProps) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderStrong,
        },
        padded && styles.padded,
        elevated && shadows.hard,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  base: {
    borderWidth,
    borderRadius: radius.sm,
  },
  padded: { padding: spacing.md },
});
