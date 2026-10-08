import type { ComponentProps } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadows } from "../../theme";
import { PressableScale } from "./PressableScale";

export interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
  /** Floating over the map: adds a shadow. */
  floating?: boolean;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 44,
  color = colors.ink,
  background = colors.surface,
  style,
  floating = false,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      scaleTo={0.9}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        floating && shadows.md,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
