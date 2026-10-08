import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import type { Place } from "@orbit/shared";
import { useCircles } from "../hooks/useCircles";
import { usePlaces } from "../hooks/usePlaces";
import { useActiveCircleStore } from "../lib/active-circle-store";
import { useAuthStore } from "../lib/auth-store";
import { ApiError } from "../lib/api-client";
import { sharePublicLink, startSharing } from "../lib/sharing";
import { ModalScreen, ModalSection } from "../components/ModalScreen";
import { AppText, AvatarStack, Button, Card, Chip, ToggleRow } from "../components/ui";
import { colors, radius, layoutTransition } from "../theme";

const DURATIONS: { label: string; minutes?: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "3 h", minutes: 180 },
  { label: "Sans limite" },
];

/** Start sharing with the active circle: where to, for how long, and optionally a public link. */
export default function ShareScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: circles } = useCircles();
  const circle = circles?.find((c) => c.id === circleId);
  const { data: places } = usePlaces(circleId);

  const [destination, setDestination] = useState<Place | null>(null);
  const [minutes, setMinutes] = useState<number | undefined>(60);
  const [publicLink, setPublicLink] = useState(false);
  // "Rentre bien" follows the destination (useful for a trip) until toggled by hand.
  const [safetyChoice, setSafetyChoice] = useState<boolean | null>(null);
  const safety = safetyChoice ?? destination != null;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const others = circle?.members.filter((m) => m.userId !== user?.id) ?? [];
  const audience =
    others.length === 0
      ? "Personne d'autre n'est encore dans ce cercle"
      : others.length <= 2
        ? others.map((m) => m.displayName.split(" ")[0]).join(" et ")
        : `${others[0].displayName.split(" ")[0]} et ${others.length - 1} autres`;

  const until = destination
    ? `jusqu'à ton arrivée à ${destination.name}${minutes ? ` (max ${DURATIONS.find((d) => d.minutes === minutes)?.label})` : ""}`
    : minutes
      ? `pendant ${DURATIONS.find((d) => d.minutes === minutes)?.label}`
      : "jusqu'à ce que tu arrêtes";

  const onStart = async () => {
    if (!circleId) return;
    setError(null);
    setStarting(true);
    try {
      const session = await startSharing({
        circleId,
        durationMinutes: minutes,
        destination: destination ? { latitude: destination.latitude, longitude: destination.longitude } : undefined,
        destinationName: destination?.name,
        arrivalRadiusMeters: destination?.radiusMeters,
        publicLink,
        safetyAlerts: safety,
      });
      router.back();
      if (session.publicToken) await sharePublicLink(session.publicToken, session.destinationName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <ModalScreen
      eyebrow={circle?.name}
      title="Partager mon trajet"
      footer={
        <Button
          size="lg"
          icon="paper-plane"
          label="Partager maintenant"
          loading={starting}
          disabled={!circleId}
          onPress={onStart}
        />
      }
    >
      <ModalSection title="Avec" index={0}>
        <Card style={styles.audience}>
          {circle && <AvatarStack members={others.length ? others : circle.members} size={32} />}
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
            {audience}
          </AppText>
        </Card>
      </ModalSection>

      <ModalSection title="Où vas-tu ?" index={1}>
        <View style={styles.chips}>
          <Chip label="Nulle part, en direct" icon="radio" selected={destination === null} onPress={() => setDestination(null)} />
          {places?.map((place) => (
            <Chip
              key={place.id}
              label={place.name}
              icon="flag"
              tint={colors.primary}
              selected={destination?.id === place.id}
              onPress={() => setDestination(place)}
            />
          ))}
        </View>
        {places?.length === 0 && (
          <AppText variant="caption" color={colors.muted}>
            Enregistre des lieux (Maison, Travail…) pour avoir l'heure d'arrivée et l'arrêt automatique.
          </AppText>
        )}
      </ModalSection>

      <ModalSection title={destination ? "Durée maximale" : "Pendant combien de temps ?"} index={2}>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d.label} label={d.label} selected={minutes === d.minutes} onPress={() => setMinutes(d.minutes)} />
          ))}
        </View>
      </ModalSection>

      <ModalSection title="Rentre bien" index={3}>
        <Card>
          <ToggleRow
            icon="shield-checkmark"
            title="Prévenir le cercle si ça cloche"
            subtitle={
              destination
                ? "Retard de plus de 15 min, immobile loin de ta destination, ou téléphone muet depuis 10 min."
                : "Si ton téléphone ne donne plus de nouvelles pendant 10 min."
            }
            value={safety}
            onValueChange={setSafetyChoice}
          />
        </Card>
      </ModalSection>

      <ModalSection title="Sans l'app" index={4}>
        <Card>
          <ToggleRow
            icon="link"
            title="Créer un lien de suivi"
            subtitle="Pour suivre ton trajet dans un navigateur. Il expire avec le partage."
            value={publicLink}
            onValueChange={setPublicLink}
          />
        </Card>
      </ModalSection>

      <Animated.View layout={layoutTransition} entering={FadeIn.delay(300)} style={styles.summary}>
        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        <AppText variant="body" color={colors.ink2} style={styles.flex}>
          Ta position sera visible <AppText variant="bodyStrong">{until}</AppText>, puis le partage s'arrêtera tout seul.
          {safety ? " Ton cercle sera prévenu si quelque chose cloche." : ""}
        </AppText>
      </Animated.View>

      {error && (
        <AppText variant="bodyStrong" color={colors.danger}>
          {error}
        </AppText>
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  audience: { flexDirection: "row", alignItems: "center", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summary: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
});
