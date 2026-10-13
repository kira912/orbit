import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useReactionStore, type ActiveFloatingReaction } from "../lib/reactions-store";
import { AppText } from "./ui";
import { colors, radius, shadows } from "../theme";

function SingleFloatingReaction({
  item,
  onDone,
}: {
  item: ActiveFloatingReaction;
  onDone: (animKey: string) => void;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    // Fade & pop in, float upwards, then fade out
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(1800, withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(onDone)(item.animKey);
        }
      })),
    );

    scale.value = withTiming(1, {
      duration: 350,
      easing: Easing.out(Easing.back(1.5)),
    });

    translateY.value = withTiming(-140, {
      duration: 2400,
      easing: Easing.out(Easing.quad),
    });
  }, [item.animKey, onDone, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Distribute horizontally slightly based on timestamp
  const randomOffset = ((item.timestamp % 100) - 50) * 1.5;

  return (
    <Animated.View
      style={[
        styles.reactionBubble,
        animatedStyle,
        { transform: [{ translateX: randomOffset }] },
      ]}
      pointerEvents="none"
    >
      <AppText style={styles.emojiText}>{item.emoji}</AppText>
      <View style={styles.senderPill}>
        <AppText variant="caption" color={colors.onNight} numberOfLines={1}>
          {item.fromDisplayName}
        </AppText>
      </View>
    </Animated.View>
  );
}

export function FloatingReactions() {
  const reactions = useReactionStore((s) => s.reactions);
  const removeReaction = useReactionStore((s) => s.removeReaction);

  if (reactions.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r) => (
        <SingleFloatingReaction key={r.animKey} item={r} onDone={removeReaction} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionBubble: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 48,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  senderPill: {
    marginTop: -4,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    ...shadows.sm,
  },
});
