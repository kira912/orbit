import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";
import { parseInviteCode } from "../../lib/invite-link";
import { savePendingInvite } from "../../lib/pending-invite";
import { describeJoinError, useJoinWithInvite } from "../../hooks/useJoinWithInvite";
import { AppText, Button } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Target of invite links and QR codes (…/join/<code>): joins the circle, or
 * keeps the invite aside while the visitor signs in or creates an account.
 */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = parseInviteCode(params.code ?? "");
  const authenticated = useAuthStore((s) => s.status === "authenticated");

  if (!authenticated) {
    if (code) savePendingInvite(code);
    return <Redirect href="/login" />;
  }
  return <JoinCircle code={code} />;
}

function JoinCircle({ code }: { code: string | null }) {
  const router = useRouter();
  const { joinWithInvite } = useJoinWithInvite();
  const [error, setError] = useState<string | null>(code ? null : "Ce lien d'invitation n'est pas valide");
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    joinWithInvite(code).catch((err) => setError(describeJoinError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <AppText variant="headline" color={colors.onNight} style={styles.center}>
            {error}
          </AppText>
          <Button variant="light" label="Retour à la carte" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.onNight} />
          <AppText variant="body" color={colors.onNight}>
            Connexion au cercle…
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 32,
    backgroundColor: colors.night,
  },
  center: { textAlign: "center" },
});
