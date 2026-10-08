import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../lib/auth-store";
import { ApiError } from "../lib/api-client";
import { API_URL } from "../constants/config";
import { googleSignInAvailable, hasPendingGoogleSignIn } from "../lib/google-sign-in";
import { colors, radius } from "../theme";
import { AppText, PressableScale } from "./ui";

/**
 * "Continuer avec Google" with an "ou" separator, for the auth screens.
 * Renders nothing where Google Sign-In can't work (Expo Go, no client id).
 */
export function GoogleButton({ onError }: { onError: (message: string | null) => void }) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [busy, setBusy] = useState(false);

  // Web: back from Google's page, finish the sign-in it started (or show why it failed).
  useEffect(() => {
    if (googleSignInAvailable && hasPendingGoogleSignIn()) void onPress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!googleSignInAvailable) return null;

  async function onPress() {
    onError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError
            ? `Serveur injoignable (${API_URL})`
            : ((err as Error).message ?? "Connexion Google impossible"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.separator}>
        <View style={styles.line} />
        <AppText variant="caption" color={colors.onNightMuted}>
          ou
        </AppText>
        <View style={styles.line} />
      </View>
      <PressableScale style={styles.button} onPress={onPress} disabled={busy} accessibilityRole="button">
        <Ionicons name="logo-google" size={20} color="#4285F4" />
        <AppText variant="bodyStrong" color={colors.ink}>
          {busy ? "Connexion…" : "Continuer avec Google"}
        </AppText>
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  separator: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.25)" },
  button: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
