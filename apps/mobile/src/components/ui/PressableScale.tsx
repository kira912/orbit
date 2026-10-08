import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { springs } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
  haptic?: "light" | "medium" | "selection" | false;
  /** Fade when disabled (buttons); off for rows that are simply not tappable. */
  dimWhenDisabled?: boolean;
}

/** Pressable that springs down under the finger, with an optional haptic tick. */
export function PressableScale({
  style,
  children,
  scaleTo = 0.96,
  haptic = "light",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  dimWhenDisabled = true,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, springs.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.bouncy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === "selection") void Haptics.selectionAsync();
        else if (haptic) {
          void Haptics.impactAsync(
            haptic === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
          );
        }
        onPress?.(e);
      }}
      style={[style, animatedStyle, disabled && dimWhenDisabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
