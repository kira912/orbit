import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreateMeetup } from "../../hooks/useMeetups";
import { useAddress, usePointOrHere } from "../../hooks/useAddress";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { ApiError } from "../../lib/api-client";
import { ModalScreen, ModalSection } from "../../components/ModalScreen";
import { PointPreview } from "../../components/PointPreview";
import { AppText, Button, Card, Chip, TextField, ToggleRow } from "../../components/ui";
import { colors } from "../../theme";

const DURATIONS = [1, 2, 4, 8];

/** Propose a meeting point to the circle; everyone can then share their way there. */
export default function NewMeetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const createMeetup = useCreateMeetup();
  const { point, fromMap, error: locationError } = usePointOrHere(params.lat, params.lng);
  const address = useAddress(point?.latitude ?? null, point?.longitude ?? null);

  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [hours, setHours] = useState(2);
  const [join, setJoin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suggest the place's name until the user types their own.
  useEffect(() => {
    if (!nameEdited && address?.short) setName(address.short);
  }, [address?.short, nameEdited]);

  const onCreate = async () => {
    if (!circleId || !point) return;
    setError(null);
    try {
      const meetup = await createMeetup.mutateAsync({
        circleId,
        name: name.trim(),
        ...point,
        durationHours: hours,
        join,
      });
      router.replace(`/meetup/${meetup.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  return (
    <ModalScreen
      eyebrow="Rendez-vous"
      title="On se retrouve où ?"
      footer={
        <Button
          size="lg"
          icon="flag"
          label="Proposer au cercle"
          loading={createMeetup.isPending}
          disabled={!name.trim() || !point}
          onPress={onCreate}
        />
      }
    >
      <ModalSection title="Point de rendez-vous" index={0}>
        <PointPreview address={address} fromMap={fromMap} error={locationError} />
        {!fromMap && (
          <AppText variant="caption" color={colors.muted}>
            Astuce : un appui long sur la carte permet de choisir n'importe quel endroit.
          </AppText>
        )}
      </ModalSection>

      <ModalSection title="Nom" index={1}>
        <TextField
          icon="flag"
          placeholder="Ex : Le Comptoir, gare de Lyon…"
          value={name}
          onChangeText={(text) => {
            setNameEdited(true);
            setName(text);
          }}
          maxLength={80}
        />
      </ModalSection>

      <ModalSection title="Ouvert pendant" index={2}>
        <View style={styles.chips}>
          {DURATIONS.map((h) => (
            <Chip key={h} label={`${h} h`} selected={hours === h} onPress={() => setHours(h)} />
          ))}
        </View>
      </ModalSection>

      <ModalSection title="Toi" index={3}>
        <Card>
          <ToggleRow
            icon="navigate"
            title="Je partage mon trajet"
            subtitle="Le cercle voit ton heure d'arrivée ; ça s'arrête quand tu y es."
            value={join}
            onValueChange={setJoin}
          />
        </Card>
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
