import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectOldestCallStart, useApiActivityStore } from "../lib/api-activity-store";
import { colors, radius, shadows } from "../theme";
import { AppText } from "./ui";

/** Quick calls never show it: only waits long enough to wonder about. */
const SHOW_AFTER_MS = 600;
/** Past this, a free-tier API is most likely booting: say so. */
const WAKING_AFTER_MS = 4_000;

/**
 * Floating pill shown over every screen while the API is slow to answer, so
 * a cold start (up to a minute on Render's free tier) doesn't look frozen.
 */
export function ApiActivityIndicator() {
  const busySince = useApiActivityStore(selectOldestCallStart);
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (busySince == null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [busySince]);

  const elapsed = busySince == null ? 0 : now - busySince;
  if (busySince == null || elapsed < SHOW_AFTER_MS) return null;
  const waking = elapsed >= WAKING_AFTER_MS;

  return (
    <View pointerEvents="none" style={[styles.container, { top: insets.top + 8 }]}>
      <Animated.View
        entering={FadeInUp.duration(250)}
        exiting={FadeOutUp.duration(250)}
        style={styles.pill}
        accessibilityRole="progressbar"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator size="small" color={colors.onNight} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" color={colors.onNight}>
            {waking ? "Le serveur se réveille…" : "Chargement…"}
          </AppText>
          {waking && (
            <AppText variant="caption" color={colors.onNightMuted}>
              Ça peut prendre jusqu'à une minute
            </AppText>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 1000 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "90%",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: "rgba(11,16,32,0.92)",
    // Keeps the pill distinct on the dark auth screens too.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    ...shadows.md,
  },
  text: { flexShrink: 1 },
});
