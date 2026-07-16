import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { fonts, fontSize, spacing, radius, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
}

/**
 * Champ Canopée — surface remplie arrondie (radius.sm), bordure hairline qui
 * passe à l'accent (2 px) au focus. Label en Figtree Medium, casse normale.
 */
export function Input({ label, style, onFocus, onBlur, accessibilityLabel, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textLight}
        // `label` was only a visual sibling <Text> — RN doesn't auto-associate
        // it with the field like an HTML <label for> would (AUDIT-V5 P2 #35),
        // so VoiceOver/TalkBack announced no name. Falls back to it unless a
        // caller passes its own accessibilityLabel.
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            backgroundColor: colors.bgCard,
            color: colors.text,
            borderColor: focused ? colors.accent : colors.border,
            borderWidth: focused ? 2 : borderWidth,
            // Compense l'épaississement du focus pour éviter le "saut" du texte.
            paddingVertical: focused ? spacing.smd - 1 : spacing.smd,
            paddingHorizontal: focused ? spacing.md - 1 : spacing.md,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    letterSpacing: 0.2,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    borderRadius: radius.sm,
    minHeight: 48,
  },
});
