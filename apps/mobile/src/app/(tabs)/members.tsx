import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { haversineDistanceMeters, type CircleMember, type FriendLocation } from "@orbit/shared";
import { useCircles } from "../../hooks/useCircles";
import { useLatestLocations } from "../../hooks/useLatestLocations";
import { useNow } from "../../hooks/useNow";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useAuthStore } from "../../lib/auth-store";
import { useLiveLocationsStore } from "../../lib/live-locations-store";
import { useMapFocusStore } from "../../lib/map-focus-store";
import {
  formatDistance,
  formatRelativeTime,
  isStale,
  memberColor,
  memberInitials,
} from "../../lib/member-display";
import { MemberSheet } from "../../components/MemberSheet";

interface Row {
  member: CircleMember;
  location: FriendLocation | undefined;
  isMe: boolean;
}

/**
 * Every member of the active circle as a list, independent of the map: also
 * shows members with no known position, and works when the map doesn't.
 */
export default function MembersScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: circles, refetch: refetchCircles } = useCircles();
  const activeCircle = circles?.find((c) => c.id === circleId) ?? null;
  const latest = useLatestLocations(circleId);
  const liveLocations = useLiveLocationsStore((s) => s.byUserId);
  const focusOnMap = useMapFocusStore((s) => s.focus);
  const now = useNow();
  const myPosition = useMyLastPosition();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const all = (activeCircle?.members ?? []).map((member) => ({
      member,
      location: liveLocations[member.userId],
      isMe: member.userId === user?.id,
    }));
    // Me first, then most recently seen, then members who never shared a position.
    const seenAt = (row: Row) => (row.location ? new Date(row.location.recordedAt).getTime() : 0);
    return all.sort((a, b) => Number(b.isMe) - Number(a.isMe) || seenAt(b) - seenAt(a));
  }, [activeCircle, liveLocations, user?.id]);

  const selected = rows.find((r) => r.member.userId === selectedUserId);

  if (!activeCircle) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyText}>Rejoins ou crée un cercle dans l'onglet Cercles.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.member.userId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={latest.isRefetching}
            onRefresh={() => {
              void refetchCircles();
              void latest.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <Text style={styles.header}>
            {activeCircle.name} · {rows.length} membre{rows.length > 1 ? "s" : ""}
          </Text>
        }
        renderItem={({ item }) => (
          <MemberRow
            row={item}
            now={now}
            myPosition={myPosition}
            onPress={item.location ? () => setSelectedUserId(item.member.userId) : undefined}
          />
        )}
      />

      <MemberSheet
        location={selected?.location ?? null}
        email={selected?.member.email}
        onShowOnMap={() => {
          if (!selectedUserId) return;
          focusOnMap(selectedUserId);
          setSelectedUserId(null);
          router.navigate("/");
        }}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
}

function MemberRow({
  row,
  now,
  myPosition,
  onPress,
}: {
  row: Row;
  now: number;
  myPosition: Location.LocationObjectCoords | null;
  onPress?: () => void;
}) {
  const { member, location, isMe } = row;
  const stale = location ? isStale(location.recordedAt, now) : true;
  const color = location && !stale ? memberColor(member.userId) : "#9ca3af";

  let status: string;
  if (!location) status = "Position jamais partagée";
  else status = `${stale ? "Vu" : "À jour"} ${formatRelativeTime(location.recordedAt, now)}`;

  const distance =
    location && myPosition && !isMe ? haversineDistanceMeters(myPosition, location) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.initials}>{memberInitials(member.displayName)}</Text>
        {location && (
          <View style={[styles.presence, { backgroundColor: stale ? "#f59e0b" : "#22c55e" }]} />
        )}
      </View>

      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {member.displayName}
          {isMe && <Text style={styles.me}>  (toi)</Text>}
        </Text>
        <Text style={[styles.status, !location && styles.statusMuted]} numberOfLines={1}>
          {status}
          {distance != null && ` · ${formatDistance(distance)}`}
        </Text>
      </View>

      {location?.batteryLevel != null && (
        <View style={styles.battery}>
          <Ionicons
            name={batteryIcon(location.batteryLevel, location.batteryCharging)}
            size={18}
            color={location.batteryLevel <= 0.2 && !location.batteryCharging ? "#dc2626" : "#6b7280"}
          />
          <Text style={styles.batteryText}>{Math.round(location.batteryLevel * 100)} %</Text>
        </View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={18} color="#d1d5db" />}
    </Pressable>
  );
}

function batteryIcon(level: number, charging: boolean | null | undefined): ComponentProps<typeof Ionicons>["name"] {
  if (charging) return "battery-charging";
  if (level <= 0.2) return "battery-dead";
  if (level <= 0.6) return "battery-half";
  return "battery-full";
}

function useMyLastPosition(): Location.LocationObjectCoords | null {
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => pos && setCoords(pos.coords))
      .catch(() => {
        // No permission / no fix: distances are simply not shown.
      });
  }, []);
  return coords;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  list: { padding: 16, gap: 8 },
  header: { fontSize: 13, color: "#6b7280", marginBottom: 4, fontWeight: "500" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyText: { color: "#6b7280", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  rowPressed: { backgroundColor: "#f3f4f6" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  initials: { color: "white", fontWeight: "800", fontSize: 15 },
  presence: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "white",
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#111827" },
  me: { fontSize: 14, fontWeight: "400", color: "#6b7280" },
  status: { fontSize: 13, color: "#4b5563", marginTop: 2 },
  statusMuted: { color: "#9ca3af", fontStyle: "italic" },
  battery: { alignItems: "center" },
  batteryText: { fontSize: 11, color: "#6b7280" },
});
