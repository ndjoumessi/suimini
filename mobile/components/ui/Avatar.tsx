import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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
    // Cadrage (recentrage) choisi lors de l'ajout/changement de la photo — voir
    // PhotoAdjustControl. `expo-image` (contrairement au <Image> RN de base) sait
    // faire un vrai `contentPosition` en %, équivalent de l'`object-position` CSS
    // utilisé côté web (PersonAvatar.tsx) : même modèle {x,y} 0–100, 50/50 = centré.
    const pos = person.profilePhotoPosition;
    return (
      <Image
        source={{ uri: person.profilePhoto }}
        alt="" // décoratif : le nom de la personne est toujours affiché à côté (même patron que PersonAvatar.tsx web)
        style={[styles.base, box]}
        contentFit="cover"
        contentPosition={pos ? { left: `${pos.x}%`, top: `${pos.y}%` } : 'center'}
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
