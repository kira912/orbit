import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { colors, fonts, radius } from "../../theme";
import { AppText } from "./AppText";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Dark surfaces (auth screens). */
  dark?: boolean;
  /** Error message to display below input. */
  error?: string | null;
  /** Helper text or description below input when no error. */
  helperText?: string;
  /** Allow toggling secure text visibility for passwords. */
  showPasswordToggle?: boolean;
  /** Slot for right element (e.g. action or icon). */
  rightElement?: ReactNode;
}

/**
 * Text input with explicit colors (system defaults make placeholders
 * invisible in dark mode), accessibility attributes, password reveal toggle,
 * and a border that lights up on focus.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    icon,
    dark = false,
    error,
    helperText,
    showPasswordToggle,
    secureTextEntry,
    rightElement,
    style,
    onFocus,
    onBlur,
    accessibilityLabel,
    accessibilityHint,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasError = Boolean(error);
  const progress = useDerivedValue(() => withTiming(focused ? 1 : 0, { duration: 160 }));

  const idle = hasError
    ? colors.danger
    : dark
      ? "rgba(255,255,255,0.12)"
      : colors.line;

  const activeColor = hasError ? colors.danger : colors.primary;

  const frame = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [idle, activeColor]),
  }));

  const fg = dark ? colors.onNight : colors.ink;
  const muted = dark ? colors.onNightMuted : colors.muted;
  const shouldSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText
          variant="label"
          color={hasError ? colors.danger : muted}
          accessibilityRole="text"
        >
          {label}
        </AppText>
      )}
      <Animated.View
        style={[
          styles.frame,
          {
            backgroundColor: dark ? "rgba(255,255,255,0.06)" : colors.surface,
            borderColor: idle,
          },
          frame,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={hasError ? colors.danger : focused ? colors.primary : muted}
            aria-hidden={true}
          />
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={muted}
          selectionColor={colors.primary}
          secureTextEntry={shouldSecure}
          accessibilityLabel={accessibilityLabel ?? label ?? props.placeholder}
          accessibilityHint={accessibilityHint}
          aria-invalid={hasError}
          aria-required={props.autoComplete === "email" || props.autoComplete === "password"}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: fg },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
            style,
          ]}
        />
        {showPasswordToggle ? (
          <Pressable
            onPress={() => setIsPasswordVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            accessibilityHint="Bascule la visibilité des caractères du mot de passe"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.toggleButton}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={muted}
            />
          </Pressable>
        ) : (
          rightElement
        )}
      </Animated.View>
      {hasError ? (
        <AppText
          variant="caption"
          color="#FCA5A5"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" color={muted}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  frame: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14 },
  toggleButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
