import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { CircleWithMembers } from "@orbit/shared";
import { inviteLink } from "../lib/invite-link";
import { colors, gradients, radius, shadows } from "../theme";
import { AppText, PressableScale } from "./ui";

export function shareInvite(circle: CircleWithMembers) {
  void Share.share({
    message: `Rejoins mon cercle « ${circle.name} » sur Orbit : ${inviteLink(circle.inviteCode)} (code ${circle.inviteCode})`,
  });
}

/** The circle's invite code, front and center, with its QR code one tap away. */
export function InviteCard({ circle }: { circle: CircleWithMembers }) {
  const router = useRouter();
  return (
    <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.text}>
        <AppText variant="label" color={colors.onNightMuted}>
          Code d'invitation
        </AppText>
        <AppText variant="title" color={colors.onNight} style={styles.code} selectable>
          {circle.inviteCode}
        </AppText>
        <AppText variant="caption" color={colors.onNightMuted}>
          Partage-le pour agrandir le cercle
        </AppText>
      </View>
      <View style={styles.actions}>
        <PressableScale
          style={styles.button}
          onPress={() => router.push({ pathname: "/invite", params: { circleId: circle.id } })}
          accessibilityLabel="Afficher le QR code d'invitation"
        >
          <Ionicons name="qr-code" size={22} color={colors.ink} />
        </PressableScale>
        <PressableScale style={styles.button} onPress={() => shareInvite(circle)} accessibilityLabel="Inviter">
          <Ionicons name="share-social" size={22} color={colors.ink} />
        </PressableScale>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
    ...shadows.md,
  },
  text: { flex: 1, gap: 4 },
  code: { letterSpacing: 4 },
  actions: { gap: 10 },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
