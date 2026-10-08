import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { circlePolygon } from "@orbit/shared";
import { useCircles } from "../../hooks/useCircles";
import { usePlaces } from "../../hooks/usePlaces";
import { useLocationHistory } from "../../hooks/useLocationHistory";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useAuthStore } from "../../lib/auth-store";
import { useLiveLocationsStore } from "../../lib/live-locations-store";
import { useEventsFeedStore } from "../../lib/events-feed-store";
import { useMapFocusStore } from "../../lib/map-focus-store";
import { memberColor } from "../../lib/member-display";
import { useNow } from "../../hooks/useNow";
import { FriendsLayer } from "../../components/FriendsLayer";
import { MemberSheet } from "../../components/MemberSheet";

// Free vector style, no API key/account needed (run by the OpenFreeMap non-profit).
// Swap for "...dark" or another OpenFreeMap style name to change the look.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const HISTORY_WINDOW_HOURS = 2;
const MIN_TRAJECTORY_SPAN_DEG = 0.003;
/** MapLibre uses GeoJSON's [longitude, latitude] order, not {latitude, longitude}. */
const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566];

export default function MapScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: circles } = useCircles();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const activeCircle = circles?.find((c) => c.id === circleId) ?? null;
  const { data: places } = usePlaces(circleId);
  const liveLocations = useLiveLocationsStore((s) => s.byUserId);
  const feed = useEventsFeedStore((s) => s.feed);

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Camera follows the user until something else needs the viewport (a trajectory, a pan).
  const [followMe, setFollowMe] = useState(true);
  const cameraRef = useRef<CameraRef>(null);
  const focusRequest = useMapFocusStore((s) => s.userId);
  const consumeFocus = useMapFocusStore((s) => s.consume);
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(
      ({ status }) => setHasLocationPermission(status === "granted"),
      () => {
        // Permission request failed: stay on the default center.
      },
    );
  }, []);

  const memberIds = useMemo(
    () => new Set(activeCircle?.members.map((m) => m.userId) ?? []),
    [activeCircle],
  );

  const friendMarkers = useMemo(
    () =>
      Object.values(liveLocations).filter(
        (loc) => memberIds.has(loc.userId) && loc.userId !== user?.id,
      ),
    [liveLocations, memberIds, user?.id],
  );

  const selectedLocation = selectedUserId ? (liveLocations[selectedUserId] ?? null) : null;
  const selectedEmail = activeCircle?.members.find((m) => m.userId === selectedUserId)?.email;
  const toggleHistory = (userId: string) => {
    if (historyUserId === userId) {
      setHistoryUserId(null);
      setFollowMe(true); // back to the user's own position
      return;
    }
    setHistoryUserId(userId);
    setSelectedUserId(null); // the sheet would hide half of the trajectory
    setFollowMe(false); // let the trajectory take the viewport
  };

  const historyRange = useMemo(() => {
    if (!historyUserId || !circleId) return null;
    const to = new Date();
    const from = new Date(to.getTime() - HISTORY_WINDOW_HOURS * 60 * 60 * 1000);
    return { userId: historyUserId, circleId, from, to };
  }, [historyUserId, circleId]);

  const { data: history, isSuccess: historyLoaded } = useLocationHistory(historyRange);

  const historyLineGeoJson = useMemo(() => {
    if (!history) return null;
    // Consecutive identical pings (member standing still) would make a zero-length
    // line, which MapLibre rejects with "Invalid geometry in line layer".
    const coordinates = history
      .map((p) => [p.longitude, p.latitude])
      .filter((c, i, all) => i === 0 || c[0] !== all[i - 1][0] || c[1] !== all[i - 1][1]);
    if (coordinates.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
    };
  }, [history]);

  // Zoom on the trajectory once loaded: at city zoom a short walk fits under the avatar.
  useEffect(() => {
    const coords = historyLineGeoJson?.geometry.coordinates;
    if (!coords) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    // A few meters of trajectory would zoom in to street-furniture level: keep a ~300 m minimum span.
    const pad = (min: number, max: number) => Math.max(0, (MIN_TRAJECTORY_SPAN_DEG - (max - min)) / 2);
    const padLng = pad(Math.min(...lngs), Math.max(...lngs));
    const padLat = pad(Math.min(...lats), Math.max(...lats));
    cameraRef.current?.fitBounds(
      [
        Math.min(...lngs) - padLng,
        Math.min(...lats) - padLat,
        Math.max(...lngs) + padLng,
        Math.max(...lats) + padLat,
      ],
      { padding: { top: 90, right: 50, bottom: 90, left: 50 }, duration: 800 },
    );
  }, [historyLineGeoJson]);

  // "Voir sur la carte" from the members list: fly to that member and highlight them.
  useEffect(() => {
    if (!focusRequest) return;
    consumeFocus();
    const loc = liveLocations[focusRequest];
    if (!loc) return;
    setFollowMe(false);
    setFocusedUserId(focusRequest);
    // On first visit the tab (and its camera) is still mounting: give it a moment.
    setTimeout(
      () =>
        cameraRef.current?.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, duration: 800 }),
      cameraRef.current ? 50 : 600,
    );
  }, [focusRequest, consumeFocus, liveLocations]);

  const noTrajectory = historyUserId != null && historyLoaded && historyLineGeoJson == null;

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE_URL}>
        {/* Follows the user natively once permission is granted (panning stops it);
            the initial view only shows until the first fix arrives. */}
        <Camera
          ref={cameraRef}
          initialViewState={{ center: DEFAULT_CENTER, zoom: 13 }}
          trackUserLocation={hasLocationPermission && followMe ? "default" : undefined}
          onTrackUserLocationChange={(e) => {
            // The native side drops tracking when the user pans the map.
            if (e.nativeEvent.trackUserLocation == null) setFollowMe(false);
          }}
        />
        {hasLocationPermission && <UserLocation />}

        <FriendsLayer
          locations={friendMarkers}
          selectedUserId={selectedUserId ?? focusedUserId}
          now={now}
          onSelect={(userId) => {
            setFocusedUserId(null);
            setSelectedUserId(userId);
          }}
        />

        {places?.map((place) => {
          const ring = circlePolygon(
            { latitude: place.latitude, longitude: place.longitude },
            place.radiusMeters,
          );
          const geojson = {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "Polygon" as const,
              coordinates: [ring.map((p) => [p.longitude, p.latitude])],
            },
          };
          const sourceId = `place-${place.id}`;
          return (
            <GeoJSONSource key={place.id} id={sourceId} data={geojson}>
              <Layer
                id={`${sourceId}-fill`}
                type="fill"
                source={sourceId}
                paint={{ "fill-color": "#2563eb", "fill-opacity": 0.15 }}
              />
              <Layer
                id={`${sourceId}-outline`}
                type="line"
                source={sourceId}
                paint={{ "line-color": "#2563eb", "line-width": 2 }}
              />
            </GeoJSONSource>
          );
        })}

        {historyLineGeoJson && (
          <GeoJSONSource id="history-line" data={historyLineGeoJson}>
            <Layer
              id="history-line-layer"
              type="line"
              // Mounted after the members layer; keep the line underneath the avatars.
              beforeId="friends-selected-halo"
              source="history-line"
              paint={{
                "line-color": historyUserId ? memberColor(historyUserId) : "#dc2626",
                "line-width": 4,
                "line-opacity": 0.8,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {activeCircle && activeCircle.members.length > 1 && (
        <View style={styles.historyBar}>
          <FlatList
            horizontal
            data={activeCircle.members.filter((m) => m.userId !== user?.id)}
            keyExtractor={(m) => m.userId}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.chip,
                  historyUserId === item.userId && { backgroundColor: memberColor(item.userId) },
                ]}
                onPress={() => toggleHistory(item.userId)}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: historyUserId === item.userId ? "white" : memberColor(item.userId) },
                  ]}
                />
                <Text style={[styles.chipText, historyUserId === item.userId && styles.chipTextActive]}>
                  {item.displayName}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {feed.length > 0 && (
        <View style={styles.feed}>
          {feed.slice(0, 3).map((item) => (
            <Text key={item.id} style={styles.feedItem}>
              {item.kind === "geofence"
                ? `${item.event.displayName} ${item.event.type === "enter" ? "est arrivé·e à" : "a quitté"} ${item.event.placeName}`
                : `Partage terminé (${item.status})`}
            </Text>
          ))}
        </View>
      )}

      {noTrajectory && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Aucun déplacement sur les {HISTORY_WINDOW_HOURS} dernières heures</Text>
        </View>
      )}

      {hasLocationPermission && !followMe && (
        <Pressable
          style={[styles.recenter, feed.length > 0 && styles.recenterAboveFeed]}
          onPress={() => {
            setFocusedUserId(null);
            setFollowMe(true);
          }}
          accessibilityLabel="Recentrer sur ma position"
        >
          <Ionicons name="locate" size={24} color="#2563eb" />
        </Pressable>
      )}

      <MemberSheet
        location={selectedLocation}
        email={selectedEmail}
        historyActive={selectedUserId != null && historyUserId === selectedUserId}
        onToggleHistory={() => selectedUserId && toggleHistory(selectedUserId)}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  historyBar: { position: "absolute", top: 12, left: 0, right: 0, paddingHorizontal: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    elevation: 2,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { color: "#111" },
  chipTextActive: { color: "white" },
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(17,24,39,0.85)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: { color: "white", fontSize: 13 },
  recenter: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  recenterAboveFeed: { bottom: 110 },
  feed: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  feedItem: { fontSize: 13, color: "#333" },
});
