import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { MapReportKind } from "@orbit/shared";
import { useCreateMapReport } from "../../hooks/useMapReports";
import { useAddress, usePointOrHere } from "../../hooks/useAddress";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { ApiError } from "../../lib/api-client";
import { REPORT_KINDS, REPORT_KIND_ORDER } from "../../lib/report-kinds";
import { ModalScreen, ModalSection } from "../../components/ModalScreen";
import { PointPreview } from "../../components/PointPreview";
import { AppText, Button, PressableScale, TextField } from "../../components/ui";
import { colors, radius } from "../../theme";

/** Pin something on the circle's map: an accident, roadwork, a danger... */
export default function NewReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const createReport = useCreateMapReport();
  const { point, fromMap, error: locationError } = usePointOrHere(params.lat, params.lng);
  const address = useAddress(point?.latitude ?? null, point?.longitude ?? null);

  const [kind, setKind] = useState<MapReportKind | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsNote = kind === "other";
  const canSubmit = kind != null && point != null && (!needsNote || note.trim().length > 0);

  const onSubmit = async () => {
    if (!circleId || !point || !kind) return;
    setError(null);
    try {
      await createReport.mutateAsync({ circleId, kind, note: note.trim() || undefined, ...point });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  return (
    <ModalScreen
      eyebrow="Aider le cercle"
      title="Signaler"
      footer={
        <Button
          size="lg"
          icon="megaphone"
          label="Signaler au cercle"
          loading={createReport.isPending}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      }
    >
      <ModalSection title="Quoi ?" index={0}>
        <View style={styles.grid}>
          {REPORT_KIND_ORDER.map((k) => {
            const meta = REPORT_KINDS[k];
            const selected = kind === k;
            return (
              <PressableScale
                key={k}
                haptic="selection"
                onPress={() => setKind(k)}
                style={[styles.tile, selected && { borderColor: meta.color, backgroundColor: `${meta.color}14` }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={meta.label}
              >
                <View style={[styles.tileIcon, { backgroundColor: meta.color }]}>
                  <Ionicons name={meta.icon} size={22} color={colors.onNight} />
                </View>
                <AppText variant="bodyStrong" style={styles.tileLabel}>
                  {meta.label}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {meta.hint}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </ModalSection>

      <ModalSection title="Où ?" index={1}>
        <PointPreview address={address} fromMap={fromMap} error={locationError} />
      </ModalSection>

      <ModalSection title={needsNote ? "Précise (obligatoire)" : "Un détail ? (facultatif)"} index={2}>
        <TextField
          icon="create-outline"
          placeholder={needsNote ? "Ex : plaque de verglas, chien perdu…" : "Ex : voie de droite bloquée"}
          value={note}
          onChangeText={setNote}
          maxLength={140}
        />
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "31%",
    flexGrow: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tileLabel: { fontSize: 14 },
});
