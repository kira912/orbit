import { useState } from "react";
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TextField } from "../../components/TextField";
import type { CircleWithMembers } from "@orbit/shared";
import { useCircles, useCreateCircle, useJoinCircle } from "../../hooks/useCircles";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { ApiError } from "../../lib/api-client";

export default function CirclesScreen() {
  const { data: circles, isLoading } = useCircles();
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();
  const activeCircleId = useActiveCircleStore((s) => s.circleId);
  const setActiveCircleId = useActiveCircleStore((s) => s.setCircleId);

  const [newCircleName, setNewCircleName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    if (!newCircleName.trim()) return;
    setError(null);
    try {
      const circle = await createCircle.mutateAsync({ name: newCircleName.trim() });
      setNewCircleName("");
      setActiveCircleId(circle.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible");
    }
  };

  const onJoin = async () => {
    if (!inviteCode.trim()) return;
    setError(null);
    try {
      const circle = await joinCircle.mutateAsync({ inviteCode: inviteCode.trim().toUpperCase() });
      setInviteCode("");
      setActiveCircleId(circle.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code d'invitation invalide");
    }
  };

  const onShareInvite = (circle: CircleWithMembers) => {
    Share.share({
      message: `Rejoins mon cercle "${circle.name}" sur Orbit avec le code : ${circle.inviteCode}`,
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={circles ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Aucun cercle pour l'instant.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.circleCard, item.id === activeCircleId && styles.circleCardActive]}
            onPress={() => setActiveCircleId(item.id)}
          >
            <Text style={styles.circleName}>{item.name}</Text>
            <Text style={styles.circleMembers}>
              {item.members.length} membre{item.members.length > 1 ? "s" : ""}
            </Text>
            <Pressable style={styles.shareButton} onPress={() => onShareInvite(item)}>
              <Text style={styles.shareButtonText}>Inviter · {item.inviteCode}</Text>
            </Pressable>
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={styles.forms}>
            <View style={styles.form}>
              <Text style={styles.formTitle}>Créer un cercle</Text>
              <TextField
                style={styles.input}
                placeholder="Nom (ex : Famille)"
                value={newCircleName}
                onChangeText={setNewCircleName}
              />
              <Pressable style={styles.button} onPress={onCreate}>
                <Text style={styles.buttonText}>Créer</Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              <Text style={styles.formTitle}>Rejoindre avec un code</Text>
              <TextField
                style={styles.input}
                placeholder="Code d'invitation"
                autoCapitalize="characters"
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Pressable style={styles.button} onPress={onJoin}>
                <Text style={styles.buttonText}>Rejoindre</Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  list: { padding: 16, gap: 12 },
  forms: { gap: 16, marginBottom: 8 },
  form: { gap: 8 },
  formTitle: { fontWeight: "600", fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "white" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 10, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  error: { color: "#dc2626" },
  empty: { textAlign: "center", color: "#666", marginTop: 24 },
  circleCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  circleCardActive: { borderColor: "#2563eb" },
  circleName: { fontSize: 16, fontWeight: "600" },
  circleMembers: { color: "#666", fontSize: 13 },
  shareButton: { marginTop: 6, alignSelf: "flex-start" },
  shareButtonText: { color: "#2563eb", fontWeight: "500" },
});
