import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { TextField } from "../../components/TextField";
import * as Location from "expo-location";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useCreatePlace, useDeletePlace, usePlaces } from "../../hooks/usePlaces";
import { ApiError } from "../../lib/api-client";

const DEFAULT_RADIUS_METERS = 150;

export default function PlacesScreen() {
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: places, isLoading } = usePlaces(circleId);
  const createPlace = useCreatePlace();
  const deletePlace = useDeletePlace(circleId ?? "");

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (!circleId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Choisis d'abord un cercle dans l'onglet Cercles.</Text>
      </View>
    );
  }

  const onAddHere = async () => {
    if (!name.trim()) {
      setError("Donne un nom au lieu (ex : Maison)");
      return;
    }
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Permission de localisation refusée");

      const position = await Location.getCurrentPositionAsync({});
      await createPlace.mutateAsync({
        circleId,
        name: name.trim(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusMeters: DEFAULT_RADIUS_METERS,
      });
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={places ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>
              Aucun lieu. Ajoute la maison ou le bureau pour recevoir des alertes d'arrivée/départ.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.placeCard}>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{item.name}</Text>
              <Text style={styles.placeMeta}>Rayon : {item.radiusMeters} m</Text>
            </View>
            <Pressable onPress={() => deletePlace.mutate(item.id)}>
              <Text style={styles.deleteText}>Supprimer</Text>
            </Pressable>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.formTitle}>Ajouter un lieu à ta position actuelle</Text>
            <TextField
              style={styles.input}
              placeholder="Nom (ex : Maison, Travail)"
              value={name}
              onChangeText={setName}
            />
            <Pressable style={styles.button} onPress={onAddHere} disabled={locating}>
              <Text style={styles.buttonText}>
                {locating ? "Localisation..." : "Ajouter ce lieu ici"}
              </Text>
            </Pressable>
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 10 },
  form: { gap: 8, marginBottom: 16 },
  formTitle: { fontWeight: "600", fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "white" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 10, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  error: { color: "#dc2626" },
  empty: { textAlign: "center", color: "#666" },
  placeCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placeInfo: { gap: 2 },
  placeName: { fontSize: 16, fontWeight: "600" },
  placeMeta: { color: "#666", fontSize: 13 },
  deleteText: { color: "#dc2626" },
});
