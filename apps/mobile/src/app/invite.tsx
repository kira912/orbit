import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useCircles } from "../hooks/useCircles";
import { useActiveCircleStore } from "../lib/active-circle-store";
import { inviteLink } from "../lib/invite-link";
import { shareInvite } from "../components/InviteCard";
import { ModalScreen } from "../components/ModalScreen";
import { QrCode } from "../components/QrCode";
import { AppText, Button, Card } from "../components/ui";
import { colors } from "../theme";

const MAX_QR_SIZE = 280;

/** A circle's invite as a QR code, to scan from another phone (in the app or with its camera). */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ circleId?: string }>();
  const activeId = useActiveCircleStore((s) => s.circleId);
  const { data: circles } = useCircles();
  const circle = circles?.find((c) => c.id === (params.circleId ?? activeId)) ?? null;
  const { width } = useWindowDimensions();
  const qrSize = Math.min(MAX_QR_SIZE, width - 96);

  return (
    <ModalScreen
      eyebrow={circle?.name}
      title="Inviter avec un QR code"
      footer={circle && <Button icon="share-social" label="Envoyer le lien" onPress={() => shareInvite(circle)} />}
    >
      {circle && (
        <Card style={styles.card}>
          <View style={styles.qr}>
            <QrCode value={inviteLink(circle.inviteCode)} size={qrSize} />
          </View>
          <AppText variant="label" color={colors.muted}>
            Code d'invitation
          </AppText>
          <AppText variant="title" style={styles.code} selectable>
            {circle.inviteCode}
          </AppText>
          <AppText variant="body" color={colors.muted} style={styles.hint}>
            Scanne ce code avec l'appareil photo ou depuis Orbit (Mes cercles → Rejoindre) pour rejoindre « {circle.name} ».
          </AppText>
        </Card>
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: 6, paddingVertical: 24 },
  qr: { padding: 12, borderRadius: 16, backgroundColor: "#FFFFFF", marginBottom: 12 },
  code: { letterSpacing: 4 },
  hint: { textAlign: "center", marginTop: 6 },
});
