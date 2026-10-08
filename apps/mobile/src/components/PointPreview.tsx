import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Address } from "../hooks/useAddress";
import { colors } from "../theme";
import { AppText, Card } from "./ui";

/** The chosen point as an address card, for the "create here" modals. */
export function PointPreview({ address, fromMap, error }: { address: Address | null; fromMap: boolean; error: string | null }) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name={fromMap ? "pin" : "navigate"} size={20} color={colors.onNight} />
      </View>
      <View style={styles.text}>
        <AppText variant="caption" color={colors.muted}>
          {fromMap ? "Point choisi sur la carte" : "Ta position actuelle"}
        </AppText>
        <AppText variant="bodyStrong" color={error ? colors.danger : colors.ink} numberOfLines={2}>
          {error ?? address?.full ?? "Localisation…"}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
