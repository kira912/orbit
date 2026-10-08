import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeOutDown } from "react-native-reanimated";
import type { CircleShareSession, Meetup, SafetyAlertKind, ShareSession } from "@orbit/shared";
import { formatEta, formatClock } from "../../lib/eta-format";
import { formatDistance } from "../../lib/member-display";
import { useSessionEtaStore } from "../../lib/session-eta-store";
import { colors, gradients, radius, shadows, enter, layoutTransition } from "../../theme";
import { AppText, Avatar, AvatarStack, PressableScale, PulseDot } from "../ui";

interface LiveCardsProps {
  mySession: ShareSession | null;
  others: CircleShareSession[];
  meetups: Meetup[];
  onStop: (session: ShareSession) => void;
  onShareLink: (session: ShareSession) => void;
  onOk: (session: ShareSession) => void;
  onOpenMeetup: (meetup: Meetup) => void;
  onFocusMember: (userId: string) => void;
}

/** What's happening right now in the circle, as a swipeable row of cards above the tab bar. */
/** Friendly wording of a "Rentre bien" alert, for me ("tu") or about someone else. */
export function alertText(kind: SafetyAlertKind, name?: string): string {
  const who = name ?? "Tu";
  switch (kind) {
    case "late":
      return name ? `${name} n'est pas encore arrivé·e` : "Tu n'es pas encore arrivé·e";
    case "stalled":
      return `${who} ne bouge${name ? "" : "s"} plus depuis 10 min`;
    case "silent":
      return name ? `Plus de nouvelles de ${name}` : "Ton téléphone n'a plus envoyé ta position";
  }
}

export function LiveCards({ mySession, others, meetups, onStop, onShareLink, onOk, onOpenMeetup, onFocusMember }: LiveCardsProps) {
  const { width } = useWindowDimensions();
  const etas = useSessionEtaStore((s) => s.bySessionId);
  const cardWidth = width - 48;
  const count = (mySession ? 1 : 0) + others.length + meetups.length;
  if (count === 0) return null;

  return (
    <Animated.View entering={enter.up()} exiting={FadeOutDown} layout={layoutTransition}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 10}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
      >
        {mySession && (
          <MySessionCard
            width={count === 1 ? width - 32 : cardWidth}
            session={mySession}
            eta={etas[mySession.id]}
            onStop={() => onStop(mySession)}
            onShareLink={() => onShareLink(mySession)}
            onOk={() => onOk(mySession)}
          />
        )}
        {meetups.map((meetup) => (
          <MeetupCard
            key={meetup.id}
            width={count === 1 ? width - 32 : cardWidth}
            meetup={meetup}
            onPress={() => onOpenMeetup(meetup)}
          />
        ))}
        {others.map((session) => (
          <FriendCard
            key={session.id}
            width={count === 1 ? width - 32 : cardWidth}
            session={session}
            eta={etas[session.id]}
            onPress={() => onFocusMember(session.userId)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

type Eta = { etaSeconds: number; distanceMeters: number } | undefined;

function MySessionCard({
  width,
  session,
  eta,
  onStop,
  onShareLink,
  onOk,
}: {
  width: number;
  session: ShareSession;
  eta: Eta;
  onStop: () => void;
  onShareLink: () => void;
  onOk: () => void;
}) {
  const until = session.expiresAt
    ? `jusqu'à ${formatClock(session.expiresAt)}`
    : session.destination
      ? "s'arrête à l'arrivée"
      : "jusqu'à ce que tu l'arrêtes";
  const alert = session.alert;
  return (
    <LinearGradient
      colors={alert ? gradients.sunset : gradients.night}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, styles.dark, { width }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.liveBadge, alert && styles.alertBadge]}>
          <PulseDot color={alert ? colors.onNight : colors.success} size={7} />
          <AppText variant="label" color={alert ? colors.onNight : colors.success}>
            {alert ? "Ton cercle s'inquiète" : "Tu partages"}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.onNightMuted} numberOfLines={1} style={styles.until}>
          {until}
        </AppText>
      </View>
      <AppText variant="headline" color={colors.onNight} numberOfLines={1}>
        {alert ? alertText(alert) : session.destinationName ? `Vers ${session.destinationName}` : "Position en direct"}
      </AppText>
      {eta && !alert && (
        <AppText variant="caption" color={colors.onNightMuted}>
          Arrivée dans <AppText variant="caption" color={colors.cyan}>{formatEta(eta.etaSeconds)}</AppText> ·{" "}
          {formatDistance(eta.distanceMeters)}
        </AppText>
      )}
      {session.safetyAlerts && !alert && (
        <View style={styles.safetyRow}>
          <Ionicons name="shield-checkmark" size={13} color={colors.onNightMuted} />
          <AppText variant="caption" color={colors.onNightMuted}>
            Rentre bien
            {session.expectedArrivalAt ? ` · arrivée prévue ${formatClock(session.expectedArrivalAt)}` : " actif"}
          </AppText>
        </View>
      )}
      <View style={styles.cardActions}>
        {alert ? (
          <PressableScale style={[styles.pill, styles.pillOk]} onPress={onOk} haptic="medium">
            <Ionicons name="checkmark-circle" size={16} color={colors.ink} />
            <AppText variant="bodyStrong" color={colors.ink} style={styles.pillText}>
              Tout va bien
            </AppText>
          </PressableScale>
        ) : (
        <PressableScale style={[styles.pill, styles.pillLight]} onPress={onShareLink}>
          <Ionicons name="link" size={16} color={colors.onNight} />
          <AppText variant="bodyStrong" color={colors.onNight} style={styles.pillText}>
            {session.publicToken ? "Envoyer le lien" : "Créer un lien"}
          </AppText>
        </PressableScale>
        )}
        <PressableScale style={[styles.pill, styles.pillDanger]} onPress={onStop} haptic="medium">
          <Ionicons name="stop" size={14} color={colors.onNight} />
          <AppText variant="bodyStrong" color={colors.onNight} style={styles.pillText}>
            Arrêter
          </AppText>
        </PressableScale>
      </View>
    </LinearGradient>
  );
}

function MeetupCard({ width, meetup, onPress }: { width: number; meetup: Meetup; onPress: () => void }) {
  const enRoute = meetup.participants.filter((p) => p.status === "active").length;
  const arrived = meetup.participants.filter((p) => p.status === "arrived").length;
  return (
    <PressableScale style={[styles.card, styles.light, { width }]} onPress={onPress} scaleTo={0.98}>
      <View style={styles.cardTop}>
        <View style={[styles.liveBadge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="flag" size={12} color={colors.primary} />
          <AppText variant="label" color={colors.primary}>
            Rendez-vous
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </View>
      <AppText variant="headline" numberOfLines={1}>
        {meetup.name}
      </AppText>
      <View style={styles.meetupRow}>
        <AvatarStack members={meetup.participants} size={26} />
        <AppText variant="caption" color={colors.muted} style={styles.flex} numberOfLines={1}>
          {arrived + enRoute === 0
            ? "Personne en route pour l'instant"
            : [arrived > 0 && `${arrived} arrivé${arrived > 1 ? "s" : ""}`, enRoute > 0 && `${enRoute} en route`]
                .filter(Boolean)
                .join(" · ")}
        </AppText>
      </View>
    </PressableScale>
  );
}

function FriendCard({
  width,
  session,
  eta,
  onPress,
}: {
  width: number;
  session: CircleShareSession;
  eta: Eta;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.card, styles.light, styles.friend, session.alert && styles.friendAlert, { width }]}
      onPress={onPress}
      scaleTo={0.98}
    >
      <Avatar userId={session.userId} name={session.displayName} size={46} presence="live" />
      <View style={styles.flex}>
        <AppText variant="headline" numberOfLines={1}>
          {session.displayName}
        </AppText>
        {session.alert ? (
          <View style={styles.safetyRow}>
            <Ionicons name="warning" size={13} color={colors.danger} />
            <AppText variant="caption" color={colors.danger} numberOfLines={1} style={styles.flex}>
              {alertText(session.alert, session.displayName.split(" ")[0])}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {session.destinationName ? `En route vers ${session.destinationName}` : "Partage sa position"}
            {session.safetyAlerts ? " · 🛡" : ""}
          </AppText>
        )}
      </View>
      {eta && !session.alert && (
        <View style={styles.eta}>
          <AppText variant="headline" color={colors.primary}>
            {formatEta(eta.etaSeconds)}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {formatDistance(eta.distanceMeters)}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { paddingHorizontal: 16, gap: 10 },
  card: { borderRadius: radius.xl, padding: 16, gap: 6, ...shadows.lg },
  dark: { backgroundColor: colors.night },
  light: { backgroundColor: colors.surface },
  friend: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(16,185,129,0.15)",
  },
  until: { flexShrink: 1, marginLeft: 8, textAlign: "right" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillLight: { backgroundColor: "rgba(255,255,255,0.12)", flex: 1, justifyContent: "center" },
  pillDanger: { backgroundColor: colors.danger },
  pillOk: { backgroundColor: colors.surface, flex: 1, justifyContent: "center" },
  alertBadge: { backgroundColor: "rgba(255,255,255,0.2)" },
  safetyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  friendAlert: { borderWidth: 2, borderColor: colors.danger },
  pillText: { fontSize: 14 },
  meetupRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  eta: { alignItems: "flex-end" },
});
