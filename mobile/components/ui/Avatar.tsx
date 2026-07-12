import { View, Text, Image, StyleSheet } from 'react-native';
import { fonts, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Person } from '@/lib/types';
import { getInitials } from '@/lib/treeUtils';
import { getRoleColor } from '@/lib/theme';

interface AvatarProps {
  person: Person;
  size?: number;
  /** Anneau à la couleur-signal (genre / statut) de la personne. */
  ring?: boolean;
}

/**
 * Avatar rond — photo si présente, sinon initiales serif sur disque teinté à
 * la couleur-signal. Les seeds DiceBear SVG de la démo sont ignorées (RN
 * <Image> ne rend pas les SVG distants) au profit d'initiales propres.
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
    borderColor: ring ? tint : colors.border,
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
        {
          // Disque teinté ~12 % de la couleur-signal (fallback : surface muette).
          backgroundColor: /^#([0-9a-f]{6})$/i.test(tint) ? `${tint}1F` : colors.bgMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
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
