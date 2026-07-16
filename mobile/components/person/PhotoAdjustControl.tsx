/**
 * PhotoAdjustControl — recadrage léger d'une photo de profil (mobile).
 * Miroir mobile de `src/components/person/PhotoPositionControl.tsx` (web) :
 * aperçu CIRCULAIRE, on glisse la photo pour la recentrer, un bouton la
 * remet au centre. Émet un `{ x, y }` en % (0–100 ; 50/50 = centré) — la
 * même forme que `person.profilePhotoPosition` côté web, lue par
 * `components/ui/Avatar.tsx` via `contentPosition` (expo-image).
 *
 * Contrairement au web (pointer events), on utilise `PanResponder` (RN de
 * base, pas de dépendance supplémentaire) — même geste « la photo suit le
 * doigt », même clamp 0–100.
 */
import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { Move, RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { fonts, fontSize, spacing, radius } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';

export interface PhotoPosition {
  x: number;
  y: number;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function PhotoAdjustControl({
  uri,
  position,
  onChange,
  size = 176,
}: {
  uri: string;
  position: PhotoPosition;
  onChange: (pos: PhotoPosition) => void;
  size?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [dragging, setDragging] = useState(false);

  // `PanResponder.create(...)` n'est construit QU'UNE FOIS (useRef) : ses
  // callbacks ferment donc sur les valeurs de props du PREMIER rendu, pas
  // les dernières — un souci concret ici puisque `position` change en
  // continu pendant l'usage (drag, ou tap "Recentrer") alors que
  // `onPanResponderGrant` (démarrage d'un DEUXIÈME geste, etc.) a besoin de
  // la valeur À CE MOMENT-LÀ pour ancrer correctement le calcul de delta du
  // geste suivant. `latestPositionRef` est donc tenu à jour à chaque rendu
  // (lecture uniquement depuis les callbacks du PanResponder, jamais
  // pendant le rendu React lui-même) ; `baseRef` est l'ancre figée du geste
  // EN COURS (capturée une fois au pointerdown, puis lue à chaque move).
  const latestPositionRef = useRef(position);
  latestPositionRef.current = position;
  const baseRef = useRef(position);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        baseRef.current = latestPositionRef.current;
        setDragging(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        // Glisser sur toute la largeur du contrôle déplace le cadrage de 100%.
        // Glisser vers la droite montre la partie GAUCHE → x diminue (la photo
        // suit le doigt) — même sens que web.
        const nx = clampPct(baseRef.current.x - (gesture.dx / size) * 100);
        const ny = clampPct(baseRef.current.y - (gesture.dy / size) * 100);
        onChange({ x: Math.round(nx), y: Math.round(ny) });
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={t('photo.adjustLabel')}
        accessibilityValue={{ text: t('photo.adjustValue', { x: position.x, y: position.y }) }}
        // role="adjustable" tells VoiceOver/TalkBack a swipe-up/down gesture
        // is available, but nothing actually happened on that gesture
        // without this handler (AUDIT-V5 P2 #37) — the pan gesture above is
        // otherwise the only way to move the crop, unusable blind. Steps the
        // horizontal axis (the more legible single-axis proxy for "recentre
        // the photo") by 5% per increment/decrement.
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = 5;
          if (event.nativeEvent.actionName === 'increment') onChange({ x: clampPct(position.x + step), y: position.y });
          else if (event.nativeEvent.actionName === 'decrement') onChange({ x: clampPct(position.x - step), y: position.y });
        }}
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.borderStrong,
            backgroundColor: colors.bgMuted,
          },
        ]}
      >
        <Image
          source={{ uri }}
          alt=""
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          contentPosition={{ left: `${position.x}%`, top: `${position.y}%` }}
        />
        {!dragging ? (
          <View style={styles.hint} pointerEvents="none">
            <Move size={Math.round(size * 0.18)} color={colors.bg} style={styles.hintIcon} />
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onChange({ x: 50, y: 50 })}
        style={styles.resetBtn}
        accessibilityRole="button"
        hitSlop={8}
      >
        <RotateCcw size={13} color={colors.accent} />
        <Text style={[styles.resetText, { color: colors.accent }]}>{t('photo.recenterReset')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  circle: {
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  hintIcon: { opacity: 0.9 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    borderRadius: radius.sm,
  },
  resetText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
});

export default PhotoAdjustControl;
