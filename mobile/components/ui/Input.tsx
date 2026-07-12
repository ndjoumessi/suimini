import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
}

/** Atelier text field — mono label, ink border, accent focus ring. */
export function Input({ label, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {label.toUpperCase()}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textLight}
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
            borderColor: focused ? colors.accent : colors.borderStrong,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderWidth,
  },
});
