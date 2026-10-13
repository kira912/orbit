import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { sendTripReaction } from "../lib/socket";
import { AppText } from "./ui";
import { colors, radius, shadows } from "../theme";

const EMOJI_OPTIONS = ["👏", "🚀", "❤️", "☕", "⚡", "🎉", "👋"];

interface TripReactionPickerProps {
  circleId: string;
  targetUserId: string;
  onSent?: (emoji: string) => void;
}

export function TripReactionPicker({
  circleId,
  targetUserId,
  onSent,
}: TripReactionPickerProps) {
  const handlePress = (emoji: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendTripReaction(circleId, targetUserId, emoji);
    onSent?.(emoji);
  };

  return (
    <View style={styles.container}>
      <AppText variant="caption" color={colors.muted} style={styles.label}>
        Encourager le trajet :
      </AppText>
      <View style={styles.row}>
        {EMOJI_OPTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => handlePress(emoji)}
            style={({ pressed }) => [
              styles.emojiButton,
              pressed && styles.emojiButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Envoyer ${emoji}`}
          >
            <AppText style={styles.emojiText}>{emoji}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    marginBottom: 6,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.sm,
  },
  emojiButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  emojiButtonPressed: {
    transform: [{ scale: 1.25 }],
    backgroundColor: colors.primarySoft,
  },
  emojiText: {
    fontSize: 20,
  },
});
