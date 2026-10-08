import { useEffect, useState, type ComponentProps } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { haversineDistanceMeters, type FriendLocation } from "@orbit/shared";
import { useNow } from "../hooks/useNow";
import {
  formatDistance,
  formatRelativeTime,
  isStale,
  memberColor,
  memberInitials,
} from "../lib/member-display";

interface MemberSheetProps {
  location: FriendLocation | null;
  email?: string;
  /** Trajectory toggle, only offered where the trajectory can be drawn (the map). */
  historyActive?: boolean;
  onToggleHistory?: () => void;
  /** Offered outside the map (e.g. the members list). */
  onShowOnMap?: () => void;
  onClose: () => void;
}

/** Bottom sheet with everything we know about a circle member, opened by tapping their marker. */
export function MemberSheet({ location, ...props }: MemberSheetProps) {
  return (
    <Modal visible={location != null} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} accessibilityLabel="Fermer" />
      {location && <SheetContent location={location} {...props} />}
    </Modal>
  );
}

function SheetContent({
  location,
  email,
  historyActive = false,
  onToggleHistory,
  onShowOnMap,
  onClose,
}: MemberSheetProps & { location: FriendLocation }) {
  const now = useNow();
  const address = useAddress(location.latitude, location.longitude);
  const distance = useDistanceFromMe(location.latitude, location.longitude);
  const stale = isStale(location.recordedAt, now);
  const color = stale ? "#9ca3af" : memberColor(location.userId);

  const openInMaps = () => {
    const { latitude, longitude, displayName } = location;
    void Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(displayName)})`);
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.initials}>{memberInitials(location.displayName)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {location.displayName}
          </Text>
          {email && (
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
          <Ionicons name="close" size={24} color="#6b7280" />
        </Pressable>
      </View>

      <View style={[styles.freshness, stale && styles.freshnessStale]}>
        <Ionicons name={stale ? "warning" : "radio-button-on"} size={14} color={stale ? "#b45309" : "#16a34a"} />
        <Text style={[styles.freshnessText, stale && styles.freshnessTextStale]}>
          {stale ? "Position ancienne · " : "Position à jour · "}
          {formatRelativeTime(location.recordedAt, now)}
        </Text>
      </View>

      <InfoRow icon="location" label="Adresse" value={address ?? "Recherche de l'adresse…"} />
      <InfoRow
        icon="navigate"
        label="Coordonnées"
        value={`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${
          location.accuracy != null ? `  (± ${Math.round(location.accuracy)} m)` : ""
        }`}
      />
      {distance != null && <InfoRow icon="walk" label="Distance" value={`À ${formatDistance(distance)} de toi`} />}
      <InfoRow icon="speedometer" label="Vitesse" value={formatSpeed(location.speed)} />
      <InfoRow
        icon={batteryIcon(location.batteryLevel, location.batteryCharging)}
        iconColor={batteryColor(location.batteryLevel, location.batteryCharging)}
        label="Batterie"
        value={formatBattery(location.batteryLevel, location.batteryCharging)}
      />

      <View style={styles.actions}>
        {onToggleHistory && (
          <Pressable
            style={[styles.action, historyActive && { backgroundColor: color, borderColor: color }]}
            onPress={onToggleHistory}
          >
            <Ionicons name="time" size={18} color={historyActive ? "white" : "#111827"} />
            <Text style={[styles.actionText, historyActive && styles.actionTextActive]}>
              {historyActive ? "Masquer le trajet" : "Trajet (2 h)"}
            </Text>
          </Pressable>
        )}
        {onShowOnMap && (
          <Pressable style={styles.action} onPress={onShowOnMap}>
            <Ionicons name="locate" size={18} color="#111827" />
            <Text style={styles.actionText}>Voir sur la carte</Text>
          </Pressable>
        )}
        <Pressable style={styles.action} onPress={openInMaps}>
          <Ionicons name="map" size={18} color="#111827" />
          <Text style={styles.actionText}>Ouvrir dans Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  iconColor = "#6b7280",
  label,
  value,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={iconColor} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

/** Reverse-geocodes with the OS geocoder (free, no API key); null while loading or when it fails. */
function useAddress(latitude: number, longitude: number): string | null {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAddress(null);
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then(([place]) => {
        if (cancelled) return;
        if (!place) return setAddress("Adresse inconnue");
        const street = [place.streetNumber, place.street].filter(Boolean).join(" ");
        const city = [place.postalCode, place.city].filter(Boolean).join(" ");
        setAddress([street || place.name, city].filter(Boolean).join(", ") || "Adresse inconnue");
      })
      .catch(() => !cancelled && setAddress("Adresse indisponible"));
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);
  return address;
}

function useDistanceFromMe(latitude: number, longitude: number): number | null {
  const [distance, setDistance] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((me) => {
        if (me && !cancelled) {
          setDistance(haversineDistanceMeters(me.coords, { latitude, longitude }));
        }
      })
      .catch(() => {
        // No permission / no fix: just hide the distance row.
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);
  return distance;
}

function formatSpeed(speed: number | null | undefined): string {
  if (speed == null || speed < 0) return "Inconnue";
  if (speed < 0.5) return "À l'arrêt";
  return `${Math.round(speed * 3.6)} km/h`;
}

function formatBattery(level: number | null | undefined, charging: boolean | null | undefined): string {
  if (level == null) return "Non communiquée";
  return `${Math.round(level * 100)} %${charging ? " · en charge" : ""}`;
}

function batteryIcon(
  level: number | null | undefined,
  charging: boolean | null | undefined,
): ComponentProps<typeof Ionicons>["name"] {
  if (charging) return "battery-charging";
  if (level == null) return "battery-half";
  if (level <= 0.2) return "battery-dead";
  if (level <= 0.6) return "battery-half";
  return "battery-full";
}

function batteryColor(level: number | null | undefined, charging: boolean | null | undefined): string {
  if (charging) return "#16a34a";
  if (level == null) return "#6b7280";
  if (level <= 0.2) return "#dc2626";
  if (level <= 0.4) return "#d97706";
  return "#16a34a";
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  initials: { color: "white", fontWeight: "800", fontSize: 18 },
  headerText: { flex: 1 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  email: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  freshness: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 14,
    marginBottom: 6,
  },
  freshnessStale: { backgroundColor: "#fffbeb" },
  freshnessText: { fontSize: 13, color: "#15803d", fontWeight: "500" },
  freshnessTextStale: { color: "#b45309" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  rowIcon: { width: 28, marginTop: 2 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, color: "#6b7280" },
  rowValue: { fontSize: 15, color: "#111827", marginTop: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  actionTextActive: { color: "white" },
});
