import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import type { RouteProfile } from "../../lib/routing";
import { colors, radius, shadows, enter } from "../../theme";
import { AppText, IconButton, PressableScale } from "../ui";

interface RouteCardProps {
  name: string;
  summary: string;
  error: boolean;
  profile: RouteProfile;
  onProfileChange: (profile: RouteProfile) => void;
  onClose: () => void;
}

export function RouteCard({ name, summary, error, profile, onProfileChange, onClose }: RouteCardProps) {
  return (
    <Animated.View entering={enter.up()} exiting={FadeOutDown} style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="navigate" size={20} color={colors.onNight} />
      </View>
      <View style={styles.info}>
        <AppText variant="caption" color={colors.muted} numberOfLines={1}>
          Itinéraire vers {name}
        </AppText>
        <AppText variant="headline" color={error ? colors.danger : colors.ink} numberOfLines={1}>
          {summary}
        </AppText>
      </View>
      <View style={styles.modes}>
        {(["foot", "car"] as const).map((p) => (
          <PressableScale
            key={p}
            haptic="selection"
            style={[styles.mode, profile === p && styles.modeActive]}
            onPress={() => onProfileChange(p)}
            accessibilityLabel={p === "foot" ? "À pied" : "En voiture"}
            accessibilityState={{ selected: profile === p }}
          >
            <Ionicons name={p === "foot" ? "walk" : "car"} size={18} color={profile === p ? colors.onNight : colors.ink2} />
          </PressableScale>
        ))}
      </View>
      <IconButton icon="close" size={36} background={colors.bg} accessibilityLabel="Masquer l'itinéraire" onPress={onClose} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    ...shadows.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  modes: { flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.pill, padding: 3 },
  mode: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  modeActive: { backgroundColor: colors.ink },
});
