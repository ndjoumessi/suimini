import { View, Text, StyleSheet } from 'react-native';
import { fonts, fontSize, spacing, radius } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface BadgeProps {
  label: string;
  /** Couleur explicite (texte + teinte). Défaut : encre. */
  color?: string;
  /** Variante pleine : fond plein, texte papier. */
  filled?: boolean;
}

/** Convertit une couleur hex en teinte translucide pour le fond du chip. */
function tint(hex: string, alpha: string): string {
  return /^#([0-9a-f]{6})$/i.test(hex) ? `${hex}${alpha}` : hex;
}

/** Chip Canopée — pilule tonale (fond teinté 14 %), texte medium. */
export function Badge({ label, color, filled }: BadgeProps) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: filled ? c : tint(c, '24') },
      ]}
    >
      <Text
        style={[styles.label, { color: filled ? colors.bone : c }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.smd,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
  },
});
