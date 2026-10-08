import { useEffect, useState, type ComponentProps } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Animated, { FadeIn } from "react-native-reanimated";
import { haversineDistanceMeters, type FriendLocation } from "@orbit/shared";
import { useNow } from "../hooks/useNow";
import { useAddress } from "../hooks/useAddress";
import { formatDistance, formatRelativeTime, isStale } from "../lib/member-display";
import { formatEta } from "../lib/eta-format";
import { colors, radius } from "../theme";
import { AppText, Avatar, Button, PulseDot, Sheet } from "./ui";

export interface MemberTrip {
  destinationName: string | null;
  etaSeconds: number | null;
}

interface MemberSheetProps {
  location: FriendLocation | null;
  email?: string;
  /** The member's ongoing share, if any. */
  trip?: MemberTrip | null;
  /** Trajectory toggle, only offered where the trajectory can be drawn (the map). */
  historyActive?: boolean;
  onToggleHistory?: () => void;
  /** Route from me to the member, drawn on the map. */
  routeActive?: boolean;
  onToggleRoute?: () => void;
  /** Offered outside the map (e.g. the members list). */
  onShowOnMap?: () => void;
  /** "Tu es où ?": ask a member who isn't sharing to share. */
  onAskLocation?: () => void;
  askingLocation?: boolean;
  onClose: () => void;
}

/** Everything we know about a circle member, in a sheet that keeps the map visible. */
export function MemberSheet({ location, onClose, ...props }: MemberSheetProps) {
  // Keep the last member while the sheet animates out.
  const [shown, setShown] = useState(location);
  useEffect(() => {
    if (location) setShown(location);
  }, [location]);

  return (
    <Sheet visible={location != null} onClose={onClose}>
      {shown && <SheetContent location={shown} onClose={onClose} {...props} />}
    </Sheet>
  );
}

function SheetContent({
  location,
  email,
  trip,
  historyActive = false,
  onToggleHistory,
  routeActive = false,
  onToggleRoute,
  onShowOnMap,
  onAskLocation,
  askingLocation = false,
}: MemberSheetProps & { location: FriendLocation }) {
  const now = useNow();
  const address = useAddress(location.latitude, location.longitude);
  const distance = useDistanceFromMe(location.latitude, location.longitude);
  const stale = isStale(location.recordedAt, now);

  const openInMaps = () => {
    const { latitude, longitude, displayName } = location;
    void Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(displayName)})`);
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} key={location.userId}>
      <View style={styles.header}>
        <Avatar
          userId={location.userId}
          name={location.displayName}
          size={60}
          color={stale ? colors.faint : undefined}
          presence={stale ? "stale" : "live"}
        />
        <View style={styles.headerText}>
          <AppText variant="title" numberOfLines={1} style={styles.name}>
            {location.displayName}
          </AppText>
          <View style={styles.freshness}>
            {!stale && <PulseDot color={colors.success} size={7} />}
            <AppText variant="caption" color={stale ? colors.warning : colors.success}>
              {stale ? "Vu " : "En direct · "}
              {formatRelativeTime(location.recordedAt, now)}
            </AppText>
          </View>
          {email && (
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {email}
            </AppText>
          )}
        </View>
      </View>

      {trip && (
        <View style={styles.trip}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {trip.destinationName ? `En route vers ${trip.destinationName}` : "Partage sa position en direct"}
          </AppText>
          {trip.etaSeconds != null && (
            <AppText variant="bodyStrong" color={colors.primary}>
              {formatEta(trip.etaSeconds)}
            </AppText>
          )}
        </View>
      )}

      {!trip && onAskLocation && (
        <View style={styles.ask}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{stale ? "Position pas à jour" : "Ne partage pas en ce moment"}</AppText>
            <AppText variant="caption" color={colors.muted}>
              Demande-lui de partager sa position quelques minutes.
            </AppText>
          </View>
          <Button label="Tu es où ?" icon="hand-left" loading={askingLocation} onPress={onAskLocation} />
        </View>
      )}

      <View style={styles.tiles}>
        <Tile icon="walk" label="Distance" value={distance != null ? formatDistance(distance) : "—"} />
        <Tile icon="speedometer" label="Vitesse" value={formatSpeed(location.speed)} />
        <Tile
          icon={batteryIcon(location.batteryLevel, location.batteryCharging)}
          iconColor={batteryColor(location.batteryLevel, location.batteryCharging)}
          label="Batterie"
          value={location.batteryLevel != null ? `${Math.round(location.batteryLevel * 100)} %` : "—"}
        />
      </View>

      <View style={styles.address}>
        <Ionicons name="location" size={18} color={colors.muted} />
        <AppText variant="body" color={colors.ink2} style={styles.flex} numberOfLines={2}>
          {address?.full ?? "Recherche de l'adresse…"}
          {location.accuracy != null && (
            <AppText variant="caption" color={colors.muted}>{`  ± ${Math.round(location.accuracy)} m`}</AppText>
          )}
        </AppText>
      </View>

      <View style={styles.actions}>
        {onToggleRoute && (
          <Button
            style={styles.flex}
            variant={routeActive ? "secondary" : "primary"}
            icon={routeActive ? "close" : "navigate"}
            label={routeActive ? "Masquer" : "Itinéraire"}
            onPress={onToggleRoute}
          />
        )}
        {onToggleHistory && (
          <Button
            style={styles.flex}
            variant="secondary"
            icon={historyActive ? "eye-off" : "time"}
            label={historyActive ? "Masquer" : "Trajet 2 h"}
            onPress={onToggleHistory}
          />
        )}
        {onShowOnMap && (
          <Button style={styles.flex} variant="secondary" icon="locate" label="Sur la carte" onPress={onShowOnMap} />
        )}
        <Button variant="secondary" icon="open-outline" label="" accessibilityLabel="Ouvrir dans Maps" onPress={openInMaps} />
      </View>
    </Animated.View>
  );
}

function Tile({
  icon,
  iconColor = colors.primary,
  label,
  value,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <AppText variant="headline" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
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
        // No permission / no fix: just hide the distance.
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);
  return distance;
}

function formatSpeed(speed: number | null | undefined): string {
  if (speed == null || speed < 0) return "—";
  if (speed < 0.5) return "À l'arrêt";
  return `${Math.round(speed * 3.6)} km/h`;
}

export function batteryIcon(
  level: number | null | undefined,
  charging: boolean | null | undefined,
): ComponentProps<typeof Ionicons>["name"] {
  if (charging) return "battery-charging";
  if (level == null) return "battery-half";
  if (level <= 0.2) return "battery-dead";
  if (level <= 0.6) return "battery-half";
  return "battery-full";
}

export function batteryColor(level: number | null | undefined, charging: boolean | null | undefined): string {
  if (charging) return colors.success;
  if (level == null) return colors.muted;
  if (level <= 0.2) return colors.danger;
  if (level <= 0.4) return colors.warning;
  return colors.success;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 24 },
  freshness: { flexDirection: "row", alignItems: "center", gap: 6 },
  trip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  tiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  ask: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  tile: { flex: 1, gap: 2, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  address: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14, paddingHorizontal: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
});
