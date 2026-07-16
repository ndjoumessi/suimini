import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Plus, Minus, RotateCcw } from 'lucide-react-native';
import type { Person, Relationship } from '@/lib/types';
import { computeLayout } from '@/lib/treeLayout';
import { PersonNode } from './PersonNode';
import { useTheme } from '@/hooks/useTheme';

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.3;

interface TreeViewProps {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId?: string;
  onSelect?: (person: Person) => void;
}

/**
 * Pan + pinch SVG family tree. The whole canvas is one Svg inside an
 * Animated.View; gestures drive a shared translate/scale transform so it stays
 * smooth on the UI thread.
 */
export function TreeView({
  persons,
  relationships,
  rootPersonId,
  onSelect,
}: TreeViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const layout = useMemo(
    () => computeLayout(persons, relationships),
    [persons, relationships],
  );

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX + offsetX.value;
      translateY.value = e.translationY + offsetY.value;
    })
    .onEnd(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(baseScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      baseScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Button-driven zoom/reset — the only way to reach these transforms without
  // a pinch gesture (VoiceOver/TalkBack users, or anyone without two-finger
  // dexterity). Mirrors the web toolbar's zoom controls (AUDIT-V5 P0 #3).
  const zoomIn = () => {
    const next = Math.min(baseScale.value * ZOOM_STEP, MAX_SCALE);
    baseScale.value = next;
    scale.value = withTiming(next, { duration: 200 });
  };
  const zoomOut = () => {
    const next = Math.max(baseScale.value / ZOOM_STEP, MIN_SCALE);
    baseScale.value = next;
    scale.value = withTiming(next, { duration: 200 });
  };
  const resetView = () => {
    baseScale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    scale.value = withTiming(1, { duration: 200 });
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Svg width={layout.width} height={layout.height}>
            {layout.edges.map((e, i) => {
              // Right-angled "elbow" connector (down / across / down) instead
              // of a straight diagonal. On a tree with real intermarriage,
              // a parent and child rarely share the same x — many short
              // diagonals crossing each other read as noise, while the same
              // connectors bent at a shared mid-height read as a chart even
              // when several of them cross. Standard org-chart technique.
              const midY = (e.y1 + e.y2) / 2;
              const d = `M${e.x1},${e.y1} L${e.x1},${midY} L${e.x2},${midY} L${e.x2},${e.y2}`;
              return (
                <Path
                  key={`edge-${i}`}
                  d={d}
                  stroke={colors.borderStrong}
                  strokeWidth={1.25}
                  strokeOpacity={0.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            })}
            {layout.nodes.map((n) => (
              <PersonNode
                key={n.person.id}
                person={n.person}
                x={n.x}
                y={n.y}
                isRoot={n.person.id === rootPersonId}
                onPress={onSelect}
                surface={colors.bgCard}
                ink={colors.text}
                muted={colors.textMuted}
                faint={colors.textLight}
                accent={colors.accent}
              />
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>

      <View style={styles.zoomBar} pointerEvents="box-none">
        <Pressable
          onPress={zoomIn}
          accessibilityRole="button"
          accessibilityLabel={t('tree.zoomIn')}
          style={[styles.zoomBtn, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}
        >
          <Plus size={18} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={zoomOut}
          accessibilityRole="button"
          accessibilityLabel={t('tree.zoomOut')}
          style={[styles.zoomBtn, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}
        >
          <Minus size={18} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={resetView}
          accessibilityRole="button"
          accessibilityLabel={t('tree.zoomReset')}
          style={[styles.zoomBtn, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}
        >
          <RotateCcw size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomBar: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    gap: 8,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
