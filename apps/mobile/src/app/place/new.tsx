import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreatePlace } from "../../hooks/usePlaces";
import { useAddress, usePointOrHere } from "../../hooks/useAddress";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { ApiError } from "../../lib/api-client";
import { ModalScreen, ModalSection } from "../../components/ModalScreen";
import { PointPreview } from "../../components/PointPreview";
import { AppText, Button, Chip, TextField } from "../../components/ui";
import { colors } from "../../theme";

const SUGGESTIONS = ["Maison", "Travail", "École", "Sport"];
const RADII = [100, 150, 300, 500];

/** Save a place (geofence) for the circle, at a point from the map or the current position. */
export default function NewPlaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const createPlace = useCreatePlace();
  const { point, fromMap, error: locationError } = usePointOrHere(params.lat, params.lng);
  const address = useAddress(point?.latitude ?? null, point?.longitude ?? null);

  const [name, setName] = useState("");
  const [radius, setRadius] = useState(150);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!circleId || !point) return;
    setError(null);
    try {
      await createPlace.mutateAsync({ circleId, name: name.trim(), ...point, radiusMeters: radius });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  return (
    <ModalScreen
      eyebrow="Lieu du cercle"
      title="Nouveau lieu"
      footer={
        <Button
          size="lg"
          icon="checkmark"
          label="Enregistrer le lieu"
          loading={createPlace.isPending}
          disabled={!name.trim() || !point}
          onPress={onSave}
        />
      }
    >
      <ModalSection title="Où" index={0}>
        <PointPreview address={address} fromMap={fromMap} error={locationError} />
      </ModalSection>

      <ModalSection title="Nom" index={1}>
        <TextField icon="bookmark" placeholder="Ex : Maison" value={name} onChangeText={setName} maxLength={60} />
        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} selected={name === s} onPress={() => setName(s)} />
          ))}
        </View>
      </ModalSection>

      <ModalSection title="Rayon de détection" index={2}>
        <View style={styles.chips}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} m`} selected={radius === r} onPress={() => setRadius(r)} tint={colors.primary} />
          ))}
        </View>
        <AppText variant="caption" color={colors.muted}>
          Le cercle est prévenu quand quelqu'un qui partage sa position entre ou sort de cette zone.
        </AppText>
      </ModalSection>

      {error && (
        <AppText variant="bodyStrong" color={colors.danger}>
          {error}
        </AppText>
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
