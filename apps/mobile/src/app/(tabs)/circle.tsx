import { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haversineDistanceMeters, type CircleMember, type FriendLocation, type Place } from "@orbit/shared";
import { useCircles } from "../../hooks/useCircles";
import { useLatestLocations } from "../../hooks/useLatestLocations";
import { useDeletePlace, usePlaces } from "../../hooks/usePlaces";
import { useCircleShareSessions } from "../../hooks/useShareSessions";
import { useNow } from "../../hooks/useNow";
import { useAskLocationFor } from "../../hooks/useAskLocationFor";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useAuthStore } from "../../lib/auth-store";
import { useLiveLocationsStore } from "../../lib/live-locations-store";
import { useMapFocusStore } from "../../lib/map-focus-store";
import { useSessionEtaStore } from "../../lib/session-eta-store";
import { formatDistance, formatRelativeTime, isStale } from "../../lib/member-display";
import { MemberSheet, batteryColor, batteryIcon } from "../../components/MemberSheet";
import { InviteCard } from "../../components/InviteCard";
import { useTabBarClearance } from "../../components/TabBar";
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  PressableScale,
  ScreenHeader,
  Segmented,
} from "../../components/ui";
import { colors, radius, shadows, enter, layoutTransition } from "../../theme";

type Tab = "members" | "places";

/** The active circle: who's in it (with or without a known position), its places, its invite code. */
export default function CircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const user = useAuthStore((s) => s.user);
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: circles, refetch: refetchCircles, isLoading } = useCircles();
  const activeCircle = circles?.find((c) => c.id === circleId) ?? null;
  const latest = useLatestLocations(circleId);
  const { data: places } = usePlaces(circleId);
  const deletePlace = useDeletePlace(circleId ?? "");
  const { data: sessions } = useCircleShareSessions(circleId);
  const etas = useSessionEtaStore((s) => s.bySessionId);
  const liveLocations = useLiveLocationsStore((s) => s.byUserId);
  const focusOnMap = useMapFocusStore((s) => s.focus);
  const now = useNow();
  const askLocation = useAskLocationFor(circleId);
  const myPosition = useMyLastPosition();
  const [tab, setTab] = useState<Tab>("members");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = (activeCircle?.members ?? []).map((member) => ({
      member,
      location: liveLocations[member.userId],
      isMe: member.userId === user?.id,
    }));
    // Me first, then most recently seen, then members who never shared a position.
    const seenAt = (row: (typeof all)[number]) => (row.location ? new Date(row.location.recordedAt).getTime() : 0);
    return all.sort((a, b) => Number(b.isMe) - Number(a.isMe) || seenAt(b) - seenAt(a));
  }, [activeCircle, liveLocations, user?.id]);

  const selected = rows.find((r) => r.member.userId === selectedUserId);
  const selectedSession = sessions?.find((s) => s.userId === selectedUserId);

  if (!activeCircle) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        {!isLoading && (
          <EmptyState
            icon="planet-outline"
            title="Aucun cercle pour l'instant"
            message="Crée un cercle pour ta famille ou tes amis, ou rejoins-en un avec un code."
            action={<Button label="Créer ou rejoindre" icon="add" onPress={() => router.push("/circles")} />}
          />
        )}
      </View>
    );
  }

  const confirmDelete = (place: Place) =>
    Alert.alert(`Supprimer « ${place.name} » ?`, "Les alertes d'arrivée pour ce lieu s'arrêteront.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deletePlace.mutate(place.id) },
    ]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: clearance + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={latest.isRefetching}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={() => {
              void refetchCircles();
              void latest.refetch();
            }}
          />
        }
      >
        <ScreenHeader
          eyebrow={`${rows.length} membre${rows.length > 1 ? "s" : ""}`}
          title={activeCircle.name}
          right={
            <IconButton
              icon="swap-horizontal"
              floating
              accessibilityLabel="Changer de cercle"
              onPress={() => router.push("/circles")}
            />
          }
        />

        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <InviteCard circle={activeCircle} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.segment}>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "members", label: "Membres" },
              { value: "places", label: `Lieux${places?.length ? ` · ${places.length}` : ""}` },
            ]}
          />
        </Animated.View>

        {tab === "members" ? (
          <View style={styles.list}>
            {rows.map((row, index) => {
              const session = sessions?.find((s) => s.userId === row.member.userId);
              return (
                <Animated.View
                  key={row.member.userId}
                  entering={enter.up(60 * index)}
                  layout={layoutTransition}
                >
                  <MemberRow
                    member={row.member}
                    location={row.location}
                    isMe={row.isMe}
                    now={now}
                    myPosition={myPosition}
                    trip={session ? (session.destinationName ?? "Partage en direct") : null}
                    onPress={
                      row.location
                        ? () => setSelectedUserId(row.member.userId)
                        : row.isMe
                          ? undefined
                          : () =>
                              Alert.alert(
                                `Demander à ${row.member.displayName} ?`,
                                "Il ou elle recevra une demande pour partager sa position quelques minutes.",
                                [
                                  { text: "Annuler", style: "cancel" },
                                  { text: "Tu es où ?", onPress: () => askLocation.ask(row.member.userId, row.member.displayName) },
                                ],
                              )
                    }
                  />
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <View style={styles.list}>
            {(places ?? []).map((place, index) => (
              <Animated.View
                key={place.id}
                entering={enter.up(60 * index)}
                layout={layoutTransition}
                style={styles.row}
              >
                <View style={styles.placeIcon}>
                  <Ionicons name={placeIcon(place.name)} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong">{place.name}</AppText>
                  <AppText variant="caption" color={colors.muted}>
                    Alerte d'arrivée et de départ · rayon {Math.round(place.radiusMeters)} m
                  </AppText>
                </View>
                <IconButton
                  icon="trash-outline"
                  size={36}
                  color={colors.danger}
                  background={colors.dangerSoft}
                  accessibilityLabel={`Supprimer ${place.name}`}
                  onPress={() => confirmDelete(place)}
                />
              </Animated.View>
            ))}
            {places?.length === 0 && (
              <EmptyState
                icon="home-outline"
                title="Aucun lieu"
                message="Ajoute la maison, l'école ou le bureau : le cercle saura quand quelqu'un y arrive."
              />
            )}
            <Button
              variant="secondary"
              icon="add-circle"
              label="Ajouter un lieu"
              onPress={() => router.push("/place/new")}
              style={styles.addPlace}
            />
            <AppText variant="caption" color={colors.muted} align="center">
              Astuce : un appui long sur la carte enregistre n'importe quel point.
            </AppText>
          </View>
        )}
      </ScrollView>

      <MemberSheet
        location={selected?.location ?? null}
        email={selected?.member.email}
        trip={
          selectedSession
            ? {
                destinationName: selectedSession.destinationName,
                etaSeconds: etas[selectedSession.id]?.etaSeconds ?? null,
              }
            : null
        }
        askingLocation={askLocation.asking}
        onAskLocation={() =>
          selected?.location &&
          askLocation.ask(selected.member.userId, selected.member.displayName, () => setSelectedUserId(null))
        }
        onShowOnMap={() => {
          if (!selectedUserId) return;
          focusOnMap(selectedUserId);
          setSelectedUserId(null);
          router.navigate("/");
        }}
        onToggleRoute={() => {
          if (!selectedUserId) return;
          focusOnMap(selectedUserId, { route: true });
          setSelectedUserId(null);
          router.navigate("/");
        }}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
}

function MemberRow({
  member,
  location,
  isMe,
  now,
  myPosition,
  trip,
  onPress,
}: {
  member: CircleMember;
  location: FriendLocation | undefined;
  isMe: boolean;
  now: number;
  myPosition: Location.LocationObjectCoords | null;
  trip: string | null;
  onPress?: () => void;
}) {
  const stale = location ? isStale(location.recordedAt, now) : true;
  const distance = location && myPosition && !isMe ? haversineDistanceMeters(myPosition, location) : null;

  let status: string;
  if (trip) status = trip === "Partage en direct" ? trip : `En route vers ${trip}`;
  else if (!location) status = isMe ? "Position jamais partagée" : "Jamais partagée · touche pour demander";
  else status = `${stale ? "Vu" : "À jour"} ${formatRelativeTime(location.recordedAt, now)}`;

  return (
    <PressableScale style={styles.row} onPress={onPress} disabled={!onPress} scaleTo={0.98} dimWhenDisabled={false}>
      <Avatar
        userId={member.userId}
        name={member.displayName}
        size={46}
        color={location && !stale ? undefined : colors.faint}
        presence={location ? (stale ? "stale" : "live") : null}
      />
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {member.displayName}
          {isMe && <AppText variant="caption" color={colors.muted}>{"  toi"}</AppText>}
        </AppText>
        <AppText
          variant="caption"
          color={trip ? colors.primary : location ? colors.ink2 : colors.faint}
          numberOfLines={1}
        >
          {status}
          {distance != null && ` · ${formatDistance(distance)}`}
        </AppText>
      </View>
      {location?.batteryLevel != null && (
        <View style={styles.battery}>
          <Ionicons
            name={batteryIcon(location.batteryLevel, location.batteryCharging)}
            size={18}
            color={batteryColor(location.batteryLevel, location.batteryCharging)}
          />
          <AppText variant="caption" color={colors.muted} style={styles.batteryText}>
            {Math.round(location.batteryLevel * 100)}%
          </AppText>
        </View>
      )}
      {onPress && (
        <Ionicons name={location ? "chevron-forward" : "hand-left-outline"} size={18} color={location ? colors.faint : colors.primary} />
      )}
    </PressableScale>
  );
}

function placeIcon(name: string) {
  const n = name.toLowerCase();
  if (/maison|home|chez/.test(n)) return "home" as const;
  if (/travail|bureau|boulot|office/.test(n)) return "briefcase" as const;
  if (/école|ecole|fac|lycée|college|collège|school/.test(n)) return "school" as const;
  if (/sport|gym|salle|club/.test(n)) return "barbell" as const;
  return "location" as const;
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
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center" },
  content: { paddingHorizontal: 16 },
  segment: { marginTop: 20, marginBottom: 12 },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    ...shadows.sm,
  },
  rowText: { flex: 1, gap: 2 },
  battery: { alignItems: "center" },
  batteryText: { fontSize: 11 },
  placeIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addPlace: { marginTop: 6 },
});
