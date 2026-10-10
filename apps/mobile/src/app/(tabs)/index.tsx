import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Camera, GeoJSONSource, Layer, Map, Marker, UserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { circlePolygon, type ShareSession } from "@orbit/shared";
import { useCircles } from "../../hooks/useCircles";
import { usePlaces } from "../../hooks/usePlaces";
import { useLocationHistory } from "../../hooks/useLocationHistory";
import { useMeetups } from "../../hooks/useMeetups";
import { useMapReports } from "../../hooks/useMapReports";
import {
  useActiveShareSessions,
  useCircleShareSessions,
  useEnablePublicLink,
  useMarkOk,
  useStopShareSession,
} from "../../hooks/useShareSessions";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useAuthStore } from "../../lib/auth-store";
import { useLiveLocationsStore } from "../../lib/live-locations-store";
import { useMapFocusStore } from "../../lib/map-focus-store";
import { useSessionEtaStore } from "../../lib/session-eta-store";
import { formatDistance, memberColor } from "../../lib/member-display";
import { formatEta } from "../../lib/eta-format";
import { ROUTE_COLOR, type RouteProfile } from "../../lib/routing";
import { MAP_LOADING_COLOR } from "../../lib/map-style";
import { sharePublicLink } from "../../lib/sharing";
import { useMapStyle } from "../../hooks/useMapStyle";
import { useNow } from "../../hooks/useNow";
import { useAskLocationFor } from "../../hooks/useAskLocationFor";
import { useRoute } from "../../hooks/useRoute";
import { FriendsLayer } from "../../components/FriendsLayer";
import { MemberSheet } from "../../components/MemberSheet";
import { LiveCards } from "../../components/map/LiveCards";
import { MapTopBar } from "../../components/map/MapTopBar";
import { MeetupMarker } from "../../components/map/MeetupMarker";
import { ReportSheet } from "../../components/map/ReportSheet";
import { ReportsLayer } from "../../components/map/ReportsLayer";
import { RouteCard } from "../../components/map/RouteCard";
import { useTabBarClearance } from "../../components/TabBar";
import { AppText, Button, IconButton, Sheet } from "../../components/ui";
import { colors, radius, enter } from "../../theme";

const HISTORY_WINDOW_HOURS = 2;
const MIN_TRAJECTORY_SPAN_DEG = 0.003;
/** MapLibre uses GeoJSON's [longitude, latitude] order, not {latitude, longitude}. */
const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566];

export default function MapScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: circles } = useCircles();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const activeCircle = circles?.find((c) => c.id === circleId) ?? null;
  const { data: places } = usePlaces(circleId);
  const { data: meetups } = useMeetups(circleId);
  const { data: reports } = useMapReports(circleId);
  const { data: mySessions } = useActiveShareSessions();
  const { data: circleSessions } = useCircleShareSessions(circleId);
  const stopSession = useStopShareSession();
  const enableLink = useEnablePublicLink();
  const markOk = useMarkOk();
  const liveLocations = useLiveLocationsStore((s) => s.byUserId);
  const etas = useSessionEtaStore((s) => s.bySessionId);
  const clearance = useTabBarClearance();

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Camera follows the user until something else needs the viewport (a trajectory, a pan).
  const [followMe, setFollowMe] = useState(true);
  const cameraRef = useRef<CameraRef>(null);
  const [routeUserId, setRouteUserId] = useState<string | null>(null);
  const [routeProfile, setRouteProfile] = useState<RouteProfile>("foot");
  const [pressedPoint, setPressedPoint] = useState<[number, number] | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedReport = reports?.find((r) => r.id === selectedReportId) ?? null;
  const focusRequest = useMapFocusStore((s) => s.userId);
  const focusWithRoute = useMapFocusStore((s) => s.withRoute);
  const consumeFocus = useMapFocusStore((s) => s.consume);
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const now = useNow();
  const askLocation = useAskLocationFor(circleId);
  const mapStyle = useMapStyle();

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

  const mySession = mySessions?.find((s) => s.circleId === circleId) ?? null;
  const otherSessions = (circleSessions ?? []).filter((s) => s.userId !== user?.id && !s.meetupId);

  const selectedLocation = selectedUserId ? (liveLocations[selectedUserId] ?? null) : null;
  const selectedMember = activeCircle?.members.find((m) => m.userId === selectedUserId);
  const selectedEmail = selectedMember?.email;
  const selectedSession = circleSessions?.find((s) => s.userId === selectedUserId);
  const selectedTrip = selectedSession
    ? { destinationName: selectedSession.destinationName, etaSeconds: etas[selectedSession.id]?.etaSeconds ?? null }
    : null;

  const toggleHistory = (userId: string) => {
    if (historyUserId === userId) {
      setHistoryUserId(null);
      setFollowMe(true); // back to the user's own position
      return;
    }
    setHistoryUserId(userId);
    setRouteUserId(null); // one line at a time, each one frames the camera
    setSelectedUserId(null); // the sheet would hide half of the trajectory
    setFollowMe(false); // let the trajectory take the viewport
  };

  const toggleRoute = (userId: string) => {
    if (routeUserId === userId) {
      setRouteUserId(null);
      setFollowMe(true);
      return;
    }
    setRouteUserId(userId);
    setHistoryUserId(null);
    setSelectedUserId(null);
    setFocusedUserId(null);
    setFollowMe(false);
  };

  const focusMember = (userId: string) => {
    const loc = liveLocations[userId];
    if (!loc) return;
    setFollowMe(false);
    setFocusedUserId(userId);
    setSelectedUserId(userId);
    cameraRef.current?.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, duration: 900 });
  };

  const routeTarget = routeUserId ? (liveLocations[routeUserId] ?? null) : null;
  const route = useRoute(routeUserId, routeTarget, routeProfile);

  const routeLineGeoJson = useMemo(() => {
    if (!route.data || route.data.coordinates.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: route.data.coordinates },
    };
  }, [route.data]);

  /** Frames a line, keeping a ~300 m minimum span so a few meters don't zoom to street-furniture level. */
  const fitLine = (coords: number[][]) => {
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
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
      // Top padding clears the floating header, bottom the route card and tab bar.
      { padding: { top: 170, right: 50, bottom: clearance + 110, left: 50 }, duration: 800 },
    );
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
    if (coords) fitLine(coords);
  }, [historyLineGeoJson]);

  // Frame a route once per member/mode: reroutes while moving must not yank the camera away from a pan.
  const framedRouteKey = useRef<string | null>(null);
  useEffect(() => {
    if (!routeUserId) {
      framedRouteKey.current = null;
      return;
    }
    const key = `${routeUserId}:${routeProfile}`;
    if (!routeLineGeoJson || route.isPlaceholderData || framedRouteKey.current === key) return;
    framedRouteKey.current = key;
    // On first visit from the members list the camera is still mounting: give it a moment.
    setTimeout(() => fitLine(routeLineGeoJson.geometry.coordinates), cameraRef.current ? 0 : 600);
  }, [routeLineGeoJson, route.isPlaceholderData, routeUserId, routeProfile]);

  // "Sur la carte" / "Itinéraire" from the circle tab: fly to that member (or route to them).
  useEffect(() => {
    if (!focusRequest) return;
    const withRoute = focusWithRoute;
    consumeFocus();
    const loc = liveLocations[focusRequest];
    if (!loc) return;
    if (withRoute) {
      // Framing happens once the route is computed.
      setSelectedUserId(null);
      setHistoryUserId(null);
      setRouteUserId(focusRequest);
      setFollowMe(false);
      return;
    }
    setFollowMe(false);
    setFocusedUserId(focusRequest);
    // On first visit the tab (and its camera) is still mounting: give it a moment.
    setTimeout(
      () =>
        cameraRef.current?.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, duration: 800 }),
      cameraRef.current ? 50 : 600,
    );
  }, [focusRequest, focusWithRoute, consumeFocus, liveLocations]);

  const onShareLink = async (session: ShareSession) => {
    try {
      const token = session.publicToken ?? (await enableLink.mutateAsync(session.id)).publicToken;
      if (token) await sharePublicLink(token, session.destinationName);
    } catch {
      Alert.alert("Lien indisponible", "Impossible de créer le lien pour le moment.");
    }
  };

  const onStop = (session: ShareSession) => {
    Alert.alert("Arrêter le partage ?", "Ton cercle ne verra plus ta position.", [
      { text: "Annuler", style: "cancel" },
      { text: "Arrêter", style: "destructive", onPress: () => stopSession.mutate(session.id) },
    ]);
  };

  const routeName = activeCircle?.members.find((m) => m.userId === routeUserId)?.displayName;
  let routeSummary: string;
  if (!hasLocationPermission) routeSummary = "Active la localisation";
  else if (route.data) routeSummary = `${formatEta(route.data.durationSeconds)} · ${formatDistance(route.data.distanceMeters)}`;
  else if (route.isError) routeSummary = "Itinéraire indisponible";
  else if (route.waitingForPosition) routeSummary = "Localisation en cours…";
  else routeSummary = "Calcul de l'itinéraire…";

  const noTrajectory = historyUserId != null && historyLoaded && historyLineGeoJson == null;
  const historyName = activeCircle?.members.find((m) => m.userId === historyUserId)?.displayName;

  return (
    <View style={styles.container}>
      {mapStyle == null ? (
        <View style={[styles.map, { backgroundColor: MAP_LOADING_COLOR }]} />
      ) : (
        <Animated.View entering={FadeIn.duration(500)} style={styles.map}>
          <Map
            style={styles.map}
            mapStyle={mapStyle}
            logo={false}
            compass={false}
            attributionPosition={{ bottom: clearance - 8, left: 8 }}
            onLongPress={(e) => setPressedPoint(e.nativeEvent.lngLat as [number, number])}
          >
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
                properties: { name: place.name },
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
                    paint={{ "fill-color": colors.primary, "fill-opacity": 0.1 }}
                  />
                  <Layer
                    id={`${sourceId}-outline`}
                    type="line"
                    source={sourceId}
                    paint={{ "line-color": colors.primary, "line-width": 1.5, "line-dasharray": [2, 2] }}
                  />
                  <Layer
                    id={`${sourceId}-label`}
                    type="symbol"
                    source={sourceId}
                    layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 12 }}
                    paint={{ "text-color": colors.primary, "text-halo-color": "#ffffff", "text-halo-width": 2 }}
                  />
                </GeoJSONSource>
              );
            })}

            {meetups?.map((meetup) => <MeetupMarker key={meetup.id} meetup={meetup} />)}

            {reports && reports.length > 0 && (
              <ReportsLayer reports={reports} selectedId={selectedReportId} onSelect={setSelectedReportId} />
            )}

            {pressedPoint && (
              <Marker id="pressed-point" lngLat={pressedPoint} anchor="bottom">
                <Animated.View entering={enter.fade()} style={styles.droppedPin}>
                  <Ionicons name="location" size={40} color={colors.ink} />
                </Animated.View>
              </Marker>
            )}

            {historyLineGeoJson && (
              <GeoJSONSource id="history-line" data={historyLineGeoJson}>
                <Layer
                  id="history-line-layer"
                  type="line"
                  // Mounted after the members layer; keep the line underneath the avatars.
                  beforeId="friends-selected-halo"
                  source="history-line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-color": historyUserId ? memberColor(historyUserId) : colors.danger,
                    "line-width": 5,
                    "line-opacity": 0.85,
                  }}
                />
              </GeoJSONSource>
            )}

            {routeUserId && routeLineGeoJson && (
              <GeoJSONSource id="route-line" data={routeLineGeoJson}>
                {/* White casing keeps the route readable over roads of the same color. */}
                <Layer
                  id="route-line-casing"
                  type="line"
                  beforeId="friends-selected-halo"
                  source="route-line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{ "line-color": "#ffffff", "line-width": 9 }}
                />
                <Layer
                  // Remount on mode change: dropping a paint prop doesn't reliably reset it natively.
                  key={routeProfile}
                  id="route-line-layer"
                  type="line"
                  beforeId="friends-selected-halo"
                  source="route-line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-color": ROUTE_COLOR,
                    "line-width": 5,
                    // Walking routes dotted, driving routes solid, like most map apps.
                    ...(routeProfile === "foot" && { "line-dasharray": [0.1, 1.6] }),
                  }}
                />
              </GeoJSONSource>
            )}
          </Map>
        </Animated.View>
      )}

      <MapTopBar
        circle={activeCircle}
        myId={user?.id}
        locations={liveLocations}
        now={now}
        selectedUserId={selectedUserId ?? focusedUserId}
        onOpenCircles={() => router.push("/circles")}
        onSelectMember={focusMember}
      />

      {(noTrajectory || historyUserId) && (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.banner}>
          <Ionicons name="time" size={16} color={colors.onNight} />
          <AppText variant="caption" color={colors.onNight} style={styles.flex} numberOfLines={1}>
            {noTrajectory
              ? `Aucun déplacement sur les ${HISTORY_WINDOW_HOURS} dernières heures`
              : `Trajet de ${historyName ?? "ce membre"} · ${HISTORY_WINDOW_HOURS} h`}
          </AppText>
          <IconButton
            icon="close"
            size={26}
            color={colors.onNight}
            background="rgba(255,255,255,0.15)"
            accessibilityLabel="Masquer le trajet"
            onPress={() => historyUserId && toggleHistory(historyUserId)}
          />
        </Animated.View>
      )}

      <View pointerEvents="box-none" style={[styles.bottom, { bottom: clearance }]}>
        <View pointerEvents="box-none" style={styles.fabRow}>
          {!mySession && !routeUserId && activeCircle ? (
            <Animated.View entering={enter.fade()} exiting={FadeOut}>
              <Button icon="paper-plane" label="Partager mon trajet" size="lg" onPress={() => router.push("/share")} />
            </Animated.View>
          ) : (
            <View />
          )}
          <View style={styles.mapButtons}>
            {activeCircle && (
              <IconButton
                icon="warning"
                floating
                size={50}
                color={colors.warning}
                accessibilityLabel="Signaler quelque chose à ma position"
                onPress={() => router.push("/report/new")}
              />
            )}
            {hasLocationPermission && !followMe && (
              <Animated.View entering={enter.fade()} exiting={FadeOut}>
                <IconButton
                  icon="locate"
                  floating
                  size={50}
                  color={colors.primary}
                  accessibilityLabel="Recentrer sur ma position"
                  onPress={() => {
                    setFocusedUserId(null);
                    setFollowMe(true);
                  }}
                />
              </Animated.View>
            )}
          </View>
        </View>

        {routeUserId ? (
          <RouteCard
            name={routeName ?? "ce membre"}
            summary={routeSummary}
            error={route.isError}
            profile={routeProfile}
            onProfileChange={setRouteProfile}
            onClose={() => toggleRoute(routeUserId)}
          />
        ) : (
          <LiveCards
            mySession={mySession}
            others={otherSessions}
            meetups={meetups ?? []}
            onStop={onStop}
            onShareLink={onShareLink}
            onOk={(session) => markOk.mutate(session.id)}
            onOpenMeetup={(meetup) => router.push(`/meetup/${meetup.id}`)}
            onFocusMember={focusMember}
          />
        )}
      </View>

      <MemberSheet
        location={selectedLocation}
        email={selectedEmail}
        pictureUrl={selectedMember?.pictureUrl}
        trip={selectedTrip}
        askingLocation={askLocation.asking}
        onAskLocation={() =>
          selectedLocation && askLocation.ask(selectedLocation.userId, selectedLocation.displayName, () => setSelectedUserId(null))
        }
        historyActive={selectedUserId != null && historyUserId === selectedUserId}
        onToggleHistory={() => selectedUserId && toggleHistory(selectedUserId)}
        routeActive={selectedUserId != null && routeUserId === selectedUserId}
        onToggleRoute={() => selectedUserId && toggleRoute(selectedUserId)}
        onClose={() => {
          setSelectedUserId(null);
          setFocusedUserId(null);
        }}
      />

      <ReportSheet report={selectedReport} myId={user?.id} onClose={() => setSelectedReportId(null)} />

      <Sheet visible={pressedPoint != null} onClose={() => setPressedPoint(null)}>
        <AppText variant="headline">Ce point sur la carte</AppText>
        <AppText variant="caption" color={colors.muted} style={styles.sheetSub}>
          {pressedPoint ? `${pressedPoint[1].toFixed(5)}, ${pressedPoint[0].toFixed(5)}` : ""}
        </AppText>
        <View style={styles.sheetActions}>
          <Button
            icon="flag"
            label="Proposer un rendez-vous ici"
            onPress={() => {
              const [lng, lat] = pressedPoint!;
              setPressedPoint(null);
              router.push({ pathname: "/meetup/new", params: { lat: String(lat), lng: String(lng) } });
            }}
          />
          <Button
            variant="secondary"
            icon="warning"
            label="Signaler quelque chose ici"
            onPress={() => {
              const [lng, lat] = pressedPoint!;
              setPressedPoint(null);
              router.push({ pathname: "/report/new", params: { lat: String(lat), lng: String(lng) } });
            }}
          />
          <Button
            variant="secondary"
            icon="home"
            label="Enregistrer comme lieu"
            onPress={() => {
              const [lng, lat] = pressedPoint!;
              setPressedPoint(null);
              router.push({ pathname: "/place/new", params: { lat: String(lat), lng: String(lng) } });
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAP_LOADING_COLOR },
  map: { flex: 1 },
  flex: { flex: 1 },
  bottom: { position: "absolute", left: 0, right: 0, gap: 12 },
  mapButtons: { gap: 10, alignItems: "center" },
  fabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  banner: {
    position: "absolute",
    top: 150,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "90%",
    backgroundColor: "rgba(11,16,32,0.88)",
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 6,
  },
  droppedPin: { alignItems: "center" },
  sheetSub: { marginTop: 2 },
  sheetActions: { gap: 10, marginTop: 18 },
});
