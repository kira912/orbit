import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../../theme";
import { memberColor, memberInitials } from "../../lib/member-display";
import { AppText } from "./AppText";
import { PulseDot } from "./PulseDot";

export interface AvatarProps {
  userId: string;
  name: string;
  size?: number;
  /** Overrides the member color (e.g. grey for a stale position). */
  color?: string;
  presence?: "live" | "stale" | null;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A member's colored initials, identical on the map, in lists and sheets. */
export function Avatar({ userId, name, size = 44, color, presence = null, ring = false, style }: AvatarProps) {
  const background = color ?? memberColor(userId);
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
          ring && { borderWidth: 3, borderColor: colors.surface },
        ]}
      >
        <AppText variant="bodyStrong" color={colors.onNight} style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}>
          {memberInitials(name)}
        </AppText>
      </View>
      {presence && (
        <View
          style={[
            styles.presence,
            { width: dot + 4, height: dot + 4, borderRadius: (dot + 4) / 2, right: -1, bottom: -1 },
          ]}
        >
          {presence === "live" ? (
            <PulseDot color={colors.success} size={dot} />
          ) : (
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.warning }} />
          )}
        </View>
      )}
    </View>
  );
}

/** Overlapping avatars ("Ada, Bob and 3 others"). */
export function AvatarStack({
  members,
  size = 28,
  max = 4,
}: {
  members: { userId: string; displayName: string }[];
  size?: number;
  max?: number;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((m, i) => (
        <Avatar
          key={m.userId}
          userId={m.userId}
          name={m.displayName}
          size={size}
          ring
          style={{ marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: shown.length - i }}
        />
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.circle,
            styles.extra,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.35 },
          ]}
        >
          <AppText variant="caption" color={colors.ink2} style={{ fontSize: size * 0.36 }}>
            +{extra}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  presence: {
    position: "absolute",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: { flexDirection: "row", alignItems: "center" },
  extra: { backgroundColor: colors.surfaceAlt, borderWidth: 3, borderColor: colors.surface },
});
