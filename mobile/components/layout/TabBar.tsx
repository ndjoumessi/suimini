import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

/**
 * Custom Atelier bottom tab bar — top ink rule, mono uppercase labels, the
 * active tab marked with a terracotta accent bar. Passed to <Tabs tabBar={…}>.
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
          borderTopColor: colors.borderStrong,
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
        const color = focused ? colors.accent : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.marker,
                { backgroundColor: focused ? colors.accent : 'transparent' },
              ]}
            />
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label.toUpperCase()}
            </Text>
          </TouchableOpacity>
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
    gap: 3,
  },
  marker: {
    width: 22,
    height: 3,
    marginBottom: 2,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs - 2,
    letterSpacing: 0.5,
  },
});
