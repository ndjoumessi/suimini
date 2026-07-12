import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fonts, fontSize, spacing, radius, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

/**
 * Barre d'onglets Canopée — surface carte, bordure hairline, l'onglet actif
 * porte une pastille tonale derrière son icône (couleur + forme, jamais la
 * couleur seule). Passée à <Tabs tabBar={…}>. Cibles ≥ 44 pt.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom || spacing.sm,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const focused = state.index === index;
        const color = focused ? colors.accent : colors.textLight;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
          >
            <View
              style={[
                styles.iconPill,
                { backgroundColor: focused ? colors.accentLight : 'transparent' },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
            </View>
            <Text
              style={[
                styles.label,
                { color, fontFamily: focused ? fonts.bodyMedium : fonts.body },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: borderWidth,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: 48,
  },
  iconPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  label: {
    fontSize: fontSize.micro,
    letterSpacing: 0.3,
  },
});
