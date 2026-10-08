import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, radius, shadows, springs } from "../../theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Segmented control whose white thumb slides under the selected option. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width / options.length;
  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, springs.snappy) }],
  }));

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 && <Animated.View style={[styles.thumb, thumb]} />}
      {options.map((option) => (
        <PressableScale
          key={option.value}
          style={styles.option}
          haptic="selection"
          scaleTo={0.97}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
        >
          <AppText variant="bodyStrong" color={option.value === value ? colors.ink : colors.muted}>
            {option.label}
          </AppText>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    ...shadows.sm,
  },
  option: { flex: 1, alignItems: "center", paddingVertical: 9 },
});
