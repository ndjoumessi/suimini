import { View, Text, Image, StyleSheet } from 'react-native';
import { fonts, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Person } from '@/lib/types';
import { getInitials } from '@/lib/treeUtils';
import { getRoleColor } from '@/lib/theme';

interface AvatarProps {
  person: Person;
  size?: number;
  /** Ring uses the person's gender/status color. */
  ring?: boolean;
}

/**
 * Round avatar — photo if present, otherwise initials on a tinted disc.
 * The DiceBear SVG seeds used by the demo data are skipped (RN <Image> can't
 * render remote SVG) in favour of clean initials.
 */
export function Avatar({ person, size = 48, ring = true }: AvatarProps) {
  const { colors } = useTheme();
  const tint = getRoleColor(person);
  const isRaster =
    !!person.profilePhoto && !person.profilePhoto.toLowerCase().includes('.svg') &&
    !person.profilePhoto.toLowerCase().includes('/svg');

  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: ring ? tint : colors.borderStrong,
    borderWidth: ring ? 2 : borderWidth,
  };

  if (isRaster) {
    return (
      <Image
        source={{ uri: person.profilePhoto }}
        style={[styles.base, box]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        box,
        { backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.38,
          color: tint,
        }}
      >
        {getInitials(person)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
