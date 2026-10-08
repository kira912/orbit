import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { colors, radius } from "../../theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Selected background; defaults to the ink color. */
  tint?: string;
}

/** Selectable pill whose fill fades in when chosen. */
export function Chip({ label, selected = false, onPress, icon, tint = colors.ink }: ChipProps) {
  const progress = useDerivedValue(() => withTiming(selected ? 1 : 0, { duration: 180 }));
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, tint]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.line, tint]),
  }));
  const fg = selected ? colors.onNight : colors.ink;

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.chip, animated]}>
        {icon && <Ionicons name={icon} size={15} color={fg} />}
        <AppText variant="bodyStrong" color={fg} style={styles.label}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  label: { fontSize: 14, lineHeight: 18 },
});
