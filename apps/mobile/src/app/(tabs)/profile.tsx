import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Place } from "@orbit/shared";
import { useAuthStore } from "../../lib/auth-store";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { usePlaces } from "../../hooks/usePlaces";
import { useActiveShareSessions, useStartShareSession, useStopShareSession } from "../../hooks/useShareSessions";
import { useSessionEtaStore } from "../../lib/session-eta-store";
import { formatDistance, formatEta } from "../../lib/eta-format";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "../../tasks/background-location-task";
import { ApiError } from "../../lib/api-client";

const DURATION_OPTIONS: { label: string; minutes?: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "1 h", minutes: 60 },
  { label: "Illimité", minutes: undefined },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: places } = usePlaces(circleId);
  const { data: sessions } = useActiveShareSessions();
  const startSession = useStartShareSession();
  const stopSession = useStopShareSession();
  const etaBySessionId = useSessionEtaStore((s) => s.bySessionId);

  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(undefined);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const circleSessions = sessions?.filter((s) => s.circleId === circleId) ?? [];

  const onStart = async () => {
    if (!circleId) {
      setError("Choisis un cercle dans l'onglet Cercles.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      await startBackgroundLocationTracking();
      await startSession.mutateAsync({
        circleId,
        durationMinutes,
        destination: destinationPlace
          ? { latitude: destinationPlace.latitude, longitude: destinationPlace.longitude }
          : undefined,
        arrivalRadiusMeters: destinationPlace?.radiusMeters,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const onStop = async (sessionId: string) => {
    await stopSession.mutateAsync(sessionId);
    const stillActive = (sessions ?? []).some((s) => s.id !== sessionId && s.status === "active");
    if (!stillActive) {
      await stopBackgroundLocationTracking();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Pressable style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Partages actifs {circleId ? "" : "(choisis un cercle)"}</Text>
      <FlatList
        data={circleSessions}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text style={styles.empty}>Aucun partage en cours dans ce cercle.</Text>}
        renderItem={({ item }) => {
          const eta = etaBySessionId[item.id];
          return (
            <View style={styles.sessionCard}>
              <Text style={styles.sessionLabel}>
                {item.destination
                  ? eta
                    ? `Arrivée dans ${formatEta(eta.etaSeconds)} (${formatDistance(eta.distanceMeters)})`
                    : "En route..."
                  : "Partage en direct, sans destination"}
              </Text>
              <Pressable onPress={() => onStop(item.id)}>
                <Text style={styles.stopText}>Arrêter</Text>
              </Pressable>
            </View>
          );
        }}
      />

      <Text style={styles.sectionTitle}>Démarrer un partage</Text>
      <View style={styles.optionsRow}>
        {DURATION_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={[styles.chip, durationMinutes === option.minutes && styles.chipActive]}
            onPress={() => setDurationMinutes(option.minutes)}
          >
            <Text style={[styles.chipText, durationMinutes === option.minutes && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {places && places.length > 0 && (
        <>
          <Text style={styles.label}>Destination (optionnel, pour l'ETA et l'arrêt automatique)</Text>
          <View style={styles.optionsRow}>
            <Pressable
              style={[styles.chip, destinationPlace === null && styles.chipActive]}
              onPress={() => setDestinationPlace(null)}
            >
              <Text style={[styles.chipText, destinationPlace === null && styles.chipTextActive]}>
                Aucune
              </Text>
            </Pressable>
            {places.map((place) => (
              <Pressable
                key={place.id}
                style={[styles.chip, destinationPlace?.id === place.id && styles.chipActive]}
                onPress={() => setDestinationPlace(place)}
              >
                <Text
                  style={[styles.chipText, destinationPlace?.id === place.id && styles.chipTextActive]}
                >
                  {place.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={onStart} disabled={starting}>
        <Text style={styles.buttonText}>{starting ? "Démarrage..." : "Démarrer le partage"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb", padding: 16, gap: 12 },
  card: { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 4 },
  name: { fontSize: 18, fontWeight: "700" },
  email: { color: "#666" },
  logoutButton: { marginTop: 8, alignSelf: "flex-start" },
  logoutText: { color: "#dc2626", fontWeight: "600" },
  sectionTitle: { fontWeight: "600", fontSize: 15, marginTop: 8 },
  empty: { color: "#666" },
  sessionCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionLabel: { flex: 1, marginRight: 8 },
  stopText: { color: "#dc2626", fontWeight: "600" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { color: "#444", marginTop: 4 },
  chip: { backgroundColor: "white", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#ddd" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#111" },
  chipTextActive: { color: "white" },
  error: { color: "#dc2626" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "white", fontWeight: "600", fontSize: 16 },
});
