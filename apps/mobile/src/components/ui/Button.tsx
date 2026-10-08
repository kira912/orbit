import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows } from "../../theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const FOREGROUND: Record<Variant, string> = {
  primary: colors.onNight,
  secondary: colors.ink,
  ghost: colors.primary,
  danger: colors.danger,
  light: colors.ink,
};

/** The app's buttons. "primary" is the orbit gradient, used once per screen for the main action. */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  size = "md",
  style,
  accessibilityLabel,
}: ButtonProps) {
  const fg = FOREGROUND[variant];
  const content = (
    <View style={[styles.content, size === "lg" && styles.contentLg]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === "lg" ? 20 : 18} color={fg} />}
          <AppText variant="bodyStrong" color={fg} style={size === "lg" && styles.labelLg}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === "primary" ? "medium" : "light"}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.base, variantStyles[variant], style]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={gradients.orbit} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: "hidden" },
  gradient: { borderRadius: radius.lg },
  content: {
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contentLg: { minHeight: 58 },
  labelLg: { fontSize: 16 },
});

const variantStyles = StyleSheet.create({
  primary: { ...shadows.glow, overflow: "visible" },
  secondary: { backgroundColor: colors.surfaceAlt },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.dangerSoft },
  light: { backgroundColor: colors.surface, ...shadows.sm },
});
