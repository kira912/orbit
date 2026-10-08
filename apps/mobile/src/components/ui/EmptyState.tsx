import { useEffect, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme";
import { AppText } from "./AppText";

export interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  message?: string;
  action?: ReactNode;
}

/** Friendly placeholder with a gently floating icon. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * float.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.container}>
      <Animated.View style={[styles.badge, floating]}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </Animated.View>
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      {message && (
        <AppText variant="body" color={colors.muted} align="center">
          {message}
        </AppText>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 40, gap: 8 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  action: { marginTop: 12, alignSelf: "stretch" },
});
