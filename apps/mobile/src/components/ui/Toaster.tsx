import { useEffect, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { colors, radius, shadows, enter, layoutTransition } from "../../theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  color?: string;
  onPress?: () => void;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 4500;

/** In-app banners for live events (arrivals, new meetups...), fed by the realtime socket. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) =>
    set((state) => ({
      toasts: [{ ...toast, id: `${Date.now()}-${Math.random()}` }, ...state.toasts].slice(0, MAX_TOASTS),
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.container, { top: insets.top + 8 }]}>
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const timer = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);

  const color = toast.color ?? colors.primary;
  return (
    <Animated.View
      entering={enter.down()}
      exiting={FadeOutUp.duration(200)}
      layout={layoutTransition}
    >
      <PressableScale
        style={styles.toast}
        onPress={() => {
          dismiss(toast.id);
          toast.onPress?.();
        }}
      >
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Ionicons name={toast.icon ?? "notifications"} size={18} color={colors.onNight} />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" color={colors.onNight} numberOfLines={1}>
            {toast.title}
          </AppText>
          {toast.body && (
            <AppText variant="caption" color={colors.onNightMuted} numberOfLines={2}>
              {toast.body}
            </AppText>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 12, right: 12, gap: 8, zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.night2,
    borderRadius: radius.lg,
    padding: 12,
    ...shadows.lg,
  },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
});
