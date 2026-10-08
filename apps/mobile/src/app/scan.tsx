import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseInviteCode } from "../lib/invite-link";
import { describeJoinError, useJoinWithInvite } from "../hooks/useJoinWithInvite";
import { QrScanner } from "../components/QrScanner";
import { AppText, IconButton } from "../components/ui";
import { colors, radius } from "../theme";

/** A scanned code that failed is ignored this long, instead of retrying on every frame. */
const RETRY_AFTER_MS = 2500;

/** Scan a circle's invite QR code to join it. */
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { joinWithInvite, joining } = useJoinWithInvite();
  const [message, setMessage] = useState<string | null>(null);
  // The camera reports the same code many times per second: handle one at a time.
  const busy = useRef(false);
  const lastFailure = useRef<{ data: string; at: number } | null>(null);

  const onScan = async (data: string) => {
    if (busy.current) return;
    const failed = lastFailure.current;
    if (failed && failed.data === data && Date.now() - failed.at < RETRY_AFTER_MS) return;

    const code = parseInviteCode(data);
    if (!code) {
      lastFailure.current = { data, at: Date.now() };
      setMessage("Ce QR code n'est pas une invitation Orbit");
      return;
    }
    busy.current = true;
    setMessage(null);
    try {
      await joinWithInvite(code);
    } catch (err) {
      lastFailure.current = { data, at: Date.now() };
      setMessage(describeJoinError(err));
    } finally {
      busy.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <QrScanner onScan={onScan} />

      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame}>{joining && <ActivityIndicator size="large" color={colors.onNight} />}</View>
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AppText variant="title" color={colors.onNight}>
          Scanner une invitation
        </AppText>
        <IconButton
          icon="close"
          color={colors.onNight}
          background="rgba(255,255,255,0.15)"
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <AppText variant="bodyStrong" color={message ? colors.warning : colors.onNight} style={styles.center}>
          {joining ? "Connexion au cercle…" : (message ?? "Vise le QR code affiché sur le téléphone de ton proche")}
        </AppText>
      </View>
    </View>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  footer: { position: "absolute", left: 24, right: 24, bottom: 0 },
  center: { textAlign: "center" },
});
