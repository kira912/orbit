import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MapReport } from "@orbit/shared";
import { useAnswerMapReport } from "../../hooks/useMapReports";
import { useNow } from "../../hooks/useNow";
import { useAddress } from "../../hooks/useAddress";
import { REPORT_KINDS } from "../../lib/report-kinds";
import { formatRelativeTime } from "../../lib/member-display";
import { formatEta } from "../../lib/eta-format";
import { colors, radius } from "../../theme";
import { AppText, Button, Sheet } from "../ui";

/** A report's details, with "toujours là" / "plus là" for the circle to keep the map accurate. */
export function ReportSheet({
  report,
  myId,
  onClose,
}: {
  report: MapReport | null;
  myId: string | undefined;
  onClose: () => void;
}) {
  // Keep the last report while the sheet animates out.
  const [shown, setShown] = useState(report);
  useEffect(() => {
    if (report) setShown(report);
  }, [report]);

  return (
    <Sheet visible={report != null} onClose={onClose}>
      {shown && <Content report={shown} mine={shown.userId === myId} onClose={onClose} />}
    </Sheet>
  );
}

function Content({ report, mine, onClose }: { report: MapReport; mine: boolean; onClose: () => void }) {
  const now = useNow();
  const answer = useAnswerMapReport();
  const address = useAddress(report.latitude, report.longitude);
  const meta = REPORT_KINDS[report.kind];
  const remaining = Math.max(0, (new Date(report.expiresAt).getTime() - now) / 1000);

  const respond = (stillThere: boolean) =>
    answer.mutate(
      { id: report.id, stillThere },
      {
        onSuccess: onClose,
        onError: (err) => Alert.alert("Action impossible", (err as Error).message),
      },
    );

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={26} color={colors.onNight} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{meta.label}</AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {address?.full ?? "Recherche de l'adresse…"}
          </AppText>
        </View>
      </View>

      {report.note && (
        <View style={styles.note}>
          <AppText variant="body">« {report.note} »</AppText>
        </View>
      )}

      <View style={styles.meta}>
        <Meta icon="person" text={`Signalé par ${mine ? "toi" : report.displayName} ${formatRelativeTime(report.createdAt, now)}`} />
        {report.confirmations > 0 && (
          <Meta
            icon="checkmark-done"
            text={`Confirmé ${report.confirmations} fois${
              report.lastConfirmedAt ? `, dernière fois ${formatRelativeTime(report.lastConfirmedAt, now)}` : ""
            }`}
          />
        )}
        <Meta icon="hourglass" text={`Encore visible ${formatEta(remaining)}`} />
      </View>

      <View style={styles.actions}>
        {!mine && (
          <Button
            style={styles.flex}
            icon="checkmark"
            label="Toujours là"
            loading={answer.isPending && answer.variables?.stillThere === true}
            onPress={() => respond(true)}
          />
        )}
        <Button
          style={styles.flex}
          variant="secondary"
          icon={mine ? "trash-outline" : "close"}
          label={mine ? "Retirer" : "Plus là"}
          loading={answer.isPending && answer.variables?.stillThere === false}
          onPress={() => respond(false)}
        />
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: "person" | "checkmark-done" | "hourglass"; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={15} color={colors.muted} />
      <AppText variant="caption" color={colors.ink2} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  note: { padding: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  meta: { gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
