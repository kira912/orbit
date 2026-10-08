import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, enter } from "../theme";
import { AppText, OrbitLogo } from "./ui";

/** Night-sky backdrop with the animated logo, shared by login and sign-up. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flex}>
      <Stars />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={enter.fade()} style={styles.logo}>
            <OrbitLogo size={150} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.titles}>
            <AppText variant="display" color={colors.onNight} align="center">
              {title}
            </AppText>
            <AppText variant="body" color={colors.onNightMuted} align="center">
              {subtitle}
            </AppText>
          </Animated.View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Wraps a form row so rows slide in one after the other. */
export function AuthRow({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(220 + index * 70).duration(450)}>{children}</Animated.View>;
}

// Deterministic "random" stars: same sky on every render.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 37) % 100}%` as const,
  top: `${(i * 53 + 11) % 100}%` as const,
  size: (i % 3) + 1,
  opacity: 0.15 + ((i * 7) % 10) / 25,
}));

function Stars() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: "white",
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  logo: { alignItems: "center", marginBottom: 4 },
  titles: { gap: 6, marginBottom: 18 },
});
