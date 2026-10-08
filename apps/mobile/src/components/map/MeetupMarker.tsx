import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Marker } from "@maplibre/maplibre-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { Meetup } from "@orbit/shared";
import { colors, gradients, shadows } from "../../theme";
import { AppText } from "../ui";

/**
 * A meeting point: gradient pin with rippling rings so it reads as "live"
 * among the static places. Display only (no onPress): presses go through the
 * meetup cards, Marker presses being unreliable on Android (see FriendsLayer).
 */
export function MeetupMarker({ meetup }: { meetup: Meetup }) {
  const ripple = useSharedValue(0);
  useEffect(() => {
    ripple.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1);
  }, [ripple]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ripple.value),
    transform: [{ scale: 0.6 + ripple.value * 1.4 }],
  }));

  return (
    <Marker id={`meetup-${meetup.id}`} lngLat={[meetup.longitude, meetup.latitude]} anchor="bottom">
      <View style={styles.wrapper}>
        <View style={styles.label}>
          <AppText variant="caption" color={colors.onNight} numberOfLines={1} style={styles.labelText}>
            {meetup.name}
          </AppText>
        </View>
        <View style={styles.pinArea}>
          <Animated.View style={[styles.ring, ring]} />
          <LinearGradient colors={gradients.orbit} style={styles.pin}>
            <Ionicons name="flag" size={16} color={colors.onNight} />
          </LinearGradient>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  label: {
    backgroundColor: colors.night,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    maxWidth: 160,
  },
  labelText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12 },
  pinArea: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.md,
  },
});
