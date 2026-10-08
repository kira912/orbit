import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MeetupParticipant } from "@orbit/shared";
import { useEndMeetup, useJoinMeetup, useMeetup } from "../../hooks/useMeetups";
import { useActiveShareSessions, useEnablePublicLink } from "../../hooks/useShareSessions";
import { useNow } from "../../hooks/useNow";
import { useAuthStore } from "../../lib/auth-store";
import { useSessionEtaStore } from "../../lib/session-eta-store";
import { formatEta, formatClock } from "../../lib/eta-format";
import { formatDistance, formatRelativeTime } from "../../lib/member-display";
import { sharePublicLink } from "../../lib/sharing";
import { AppText, Avatar, Button, EmptyState, IconButton, OrbitLogo, PulseDot } from "../../components/ui";
import { colors, gradients, radius, shadows, enter, layoutTransition } from "../../theme";

/** A meetup: who's coming, who's there, and a one-tap "I'm on my way". */
export default function MeetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: meetup, isLoading, isError } = useMeetup(id);
  const { data: mySessions } = useActiveShareSessions();
  const joinMeetup = useJoinMeetup();
  const endMeetup = useEndMeetup();
  const enableLink = useEnablePublicLink();
  const etas = useSessionEtaStore((s) => s.bySessionId);
  const now = useNow();

  if (!meetup) {
    return (
      <View style={[styles.container, styles.center]}>
        {!isLoading && (
          <EmptyState
            icon="flag-outline"
            title={isError ? "Rendez-vous introuvable" : "Chargement…"}
            action={<Button variant="secondary" label="Fermer" onPress={() => router.back()} />}
          />
        )}
      </View>
    );
  }

  const ended = meetup.status === "ended" || new Date(meetup.endsAt).getTime() <= now;
  const mine = meetup.participants.find((p) => p.userId === user?.id && p.status === "active");
  const mySession = mySessions?.find((s) => s.id === mine?.sessionId);
  const isOrganizer = meetup.createdById === user?.id;

  const order = (p: MeetupParticipant) =>
    p.status === "arrived" ? -1 : p.status === "active" ? (etas[p.sessionId]?.etaSeconds ?? 1e9) : 2e9;
  const participants = [...meetup.participants].sort((a, b) => order(a) - order(b));
  const arrivedCount = meetup.participants.filter((p) => p.status === "arrived").length;

  const onShareLink = async () => {
    if (!mySession) return;
    const token = mySession.publicToken ?? (await enableLink.mutateAsync(mySession.id)).publicToken;
    if (token) await sharePublicLink(token, meetup.name);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <LinearGradient
          colors={gradients.night}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.heroLogo} pointerEvents="none">
            <OrbitLogo size={200} />
          </View>
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              {ended ? (
                <Ionicons name="checkmark-done" size={12} color={colors.onNightMuted} />
              ) : (
                <PulseDot color={colors.cyan} size={7} />
              )}
              <AppText variant="label" color={ended ? colors.onNightMuted : colors.cyan}>
                {ended ? "Terminé" : "Rendez-vous en cours"}
              </AppText>
            </View>
            <IconButton
              icon="close"
              color={colors.onNight}
              background="rgba(255,255,255,0.12)"
              accessibilityLabel="Fermer"
              onPress={() => router.back()}
            />
          </View>
          <Animated.View entering={FadeInDown.duration(450)}>
            <AppText variant="display" color={colors.onNight}>
              {meetup.name}
            </AppText>
            <AppText variant="body" color={colors.onNightMuted}>
              Proposé par {isOrganizer ? "toi" : meetup.createdByName} ·{" "}
              {ended
                ? "terminé"
                : `jusqu'à ${formatClock(meetup.endsAt)}`}
            </AppText>
          </Animated.View>
          <View style={styles.stats}>
            <Stat
              value={String(meetup.participants.length)}
              label={meetup.participants.length > 1 ? "participants" : "participant"}
            />
            <Stat value={String(arrivedCount)} label={arrivedCount > 1 ? "arrivés" : "arrivé"} />
          </View>
        </LinearGradient>

        <View style={styles.list}>
          <AppText variant="label" color={colors.muted}>
            Qui arrive
          </AppText>
          {participants.length === 0 && (
            <AppText variant="body" color={colors.muted}>
              Personne n'est encore en route. Sois le premier !
            </AppText>
          )}
          {participants.map((p, index) => {
            const eta = etas[p.sessionId];
            return (
              <Animated.View
                key={p.userId}
                entering={enter.up(index * 70)}
                layout={layoutTransition}
                style={styles.row}
              >
                <Avatar
                  userId={p.userId}
                  name={p.displayName}
                  size={44}
                  presence={p.status === "active" ? "live" : null}
                  color={p.status === "stopped" || p.status === "expired" ? colors.faint : undefined}
                />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">
                    {p.displayName}
                    {p.userId === user?.id && <AppText variant="caption" color={colors.muted}>{"  toi"}</AppText>}
                  </AppText>
                  <AppText variant="caption" color={colors.muted}>
                    {p.status === "arrived"
                      ? `Arrivé·e ${p.endedAt ? formatRelativeTime(p.endedAt, now) : ""}`
                      : p.status === "active"
                        ? eta
                          ? `En route · ${formatDistance(eta.distanceMeters)}`
                          : "En route"
                        : "Ne partage plus"}
                  </AppText>
                </View>
                {p.status === "arrived" ? (
                  <View style={[styles.status, { backgroundColor: colors.successSoft }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <AppText variant="bodyStrong" color={colors.success} style={styles.statusText}>
                      Là
                    </AppText>
                  </View>
                ) : p.status === "active" && eta ? (
                  <AppText variant="headline" color={colors.primary}>
                    {formatEta(eta.etaSeconds)}
                  </AppText>
                ) : null}
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {!ended && (
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {mine ? (
            <Button
              size="lg"
              variant="light"
              icon="link"
              label="Envoyer mon lien de suivi"
              onPress={onShareLink}
              style={styles.flex}
            />
          ) : (
            <Button
              size="lg"
              icon="navigate"
              label="J'y vais"
              loading={joinMeetup.isPending}
              style={styles.flex}
              onPress={() =>
                joinMeetup.mutate(
                  { id: meetup.id },
                  { onError: (err) => Alert.alert("Impossible de partager", (err as Error).message) },
                )
              }
            />
          )}
          {isOrganizer && (
            <IconButton
              icon="stop"
              size={58}
              color={colors.danger}
              background={colors.dangerSoft}
              accessibilityLabel="Terminer le rendez-vous"
              onPress={() =>
                Alert.alert("Terminer le rendez-vous ?", "Les partages en cours vers ce point s'arrêteront.", [
                  { text: "Annuler", style: "cancel" },
                  { text: "Terminer", style: "destructive", onPress: () => endMeetup.mutate(meetup.id) },
                ])
              }
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="metric" color={colors.onNight}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onNightMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center" },
  flex: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: "hidden",
  },
  heroLogo: { position: "absolute", right: -80, top: 110, opacity: 0.3 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    ...shadows.sm,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 13 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
