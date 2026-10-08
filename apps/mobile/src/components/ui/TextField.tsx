import { forwardRef, useState, type ComponentProps } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { colors, fonts, radius } from "../../theme";
import { AppText } from "./AppText";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Dark surfaces (auth screens). */
  dark?: boolean;
}

/**
 * Text input with explicit colors (system defaults make placeholders
 * invisible in dark mode) and a border that lights up on focus.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, icon, dark = false, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const progress = useDerivedValue(() => withTiming(focused ? 1 : 0, { duration: 160 }));
  const idle = dark ? "rgba(255,255,255,0.12)" : colors.line;
  const frame = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [idle, colors.primary]),
  }));
  const fg = dark ? colors.onNight : colors.ink;
  const muted = dark ? colors.onNightMuted : colors.muted;

  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText variant="label" color={muted}>
          {label}
        </AppText>
      )}
      <Animated.View
        style={[styles.frame, { backgroundColor: dark ? "rgba(255,255,255,0.06)" : colors.surface }, frame]}
      >
        {icon && <Ionicons name={icon} size={18} color={focused ? colors.primary : muted} />}
        <TextInput
          ref={ref}
          placeholderTextColor={muted}
          selectionColor={colors.primary}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: fg }, style]}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  frame: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14 },
});
