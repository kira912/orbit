import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors, gradients } from "../../theme";

/**
 * Animated brand mark: a gradient planet with two tilted orbits, each
 * carrying a satellite. Orbits are circles squashed into ellipses; the
 * satellite rides the circle's edge as the inner layer spins.
 */
export function OrbitLogo({ size = 120 }: { size?: number }) {
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
    breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [spin, breathe]);

  const planet = size * 0.36;
  const planetStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.05 }] }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Orbit size={size} tilt={-24} squash={0.38} spin={spin} speed={1} satellite={colors.cyan} />
      <Orbit size={size * 0.78} tilt={32} squash={0.42} spin={spin} speed={-1.6} satellite="#FF7AB6" />
      <Animated.View style={planetStyle}>
        <LinearGradient
          colors={gradients.orbit}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ width: planet, height: planet, borderRadius: planet / 2 }}
        />
      </Animated.View>
    </View>
  );
}

function Orbit({
  size,
  tilt,
  squash,
  spin,
  speed,
  satellite,
}: {
  size: number;
  tilt: number;
  squash: number;
  spin: SharedValue<number>;
  speed: number;
  satellite: string;
}) {
  const dot = Math.max(6, size * 0.08);
  const r = size / 2;
  // The ring is a squashed circle; the satellite follows the same ellipse by
  // trigonometry, outside the squashed layer, so it stays perfectly round.
  const satelliteStyle = useAnimatedStyle(() => {
    const angle = spin.value * Math.PI * 2 * speed;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle) * squash;
    const t = (tilt * Math.PI) / 180;
    return {
      transform: [
        { translateX: x * Math.cos(t) - y * Math.sin(t) },
        { translateY: x * Math.sin(t) + y * Math.cos(t) },
      ],
    };
  });
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: r, transform: [{ rotate: `${tilt}deg` }, { scaleY: squash }] },
        ]}
      />
      <Animated.View
        style={[{ position: "absolute", width: dot, height: dot, borderRadius: dot / 2, backgroundColor: satellite }, satelliteStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.22)" },
});
