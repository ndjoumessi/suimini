import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { Person, Relationship } from '@/lib/types';
import { computeLayout } from '@/lib/treeLayout';
import { PersonNode } from './PersonNode';
import { useTheme } from '@/hooks/useTheme';

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
      scale.value = Math.min(Math.max(baseScale.value * e.scale, 0.3), 3);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
