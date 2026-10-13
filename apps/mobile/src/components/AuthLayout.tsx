import { useEffect, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, enter, radius, shadows, fonts } from "../theme";
import { AppText, OrbitLogo } from "./ui";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * Night-sky responsive backdrop with animated logo, shared by login and sign-up.
 * Adapts fluidly between mobile (single centered card) and desktop (dual showcase panel).
 */
export function AuthLayout({
  title,
  subtitle,
  badge = "Partage sécurisé & éphémère",
  children,
  seoTitle = "Connexion | Orbit",
  seoDescription = "Partagez votre trajet temporairement en toute sécurité avec Orbit.",
}: AuthLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 920;

  // Web SEO & Accessible page title
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = seoTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute("content", seoDescription);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = seoDescription;
        document.head.appendChild(meta);
      }
    }
  }, [seoTitle, seoDescription]);

  return (
    <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flex}>
      <Stars />
      <NebulaGlow />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 24, 32),
              paddingBottom: Math.max(insets.bottom + 24, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.mainContainer, isDesktop && styles.desktopContainer]}>
            {/* Desktop Left Showcase Panel */}
            {isDesktop && (
              <Animated.View entering={enter.fade()} style={styles.showcasePanel}>
                <View style={styles.showcaseLogoRow}>
                  <OrbitLogo size={80} />
                  <View style={styles.showcaseBrand}>
                    <AppText variant="display" color={colors.onNight}>
                      Orbit
                    </AppText>
                    <AppText variant="caption" color={colors.cyan} style={styles.brandTagline}>
                      GPS TEMPORAIRE & CONSENTI
                    </AppText>
                  </View>
                </View>

                <View style={styles.showcasePitch}>
                  <AppText variant="title" color={colors.onNight} style={styles.showcaseHeading}>
                    Gardez vos proches rassurés, sans sacrifier votre vie privée.
                  </AppText>
                  <AppText variant="body" color={colors.onNightMuted}>
                    Partagez votre position en direct le temps d'un trajet ou d'un rendez-vous. Le partage s'arrête
                    automatiquement dès votre arrivée.
                  </AppText>
                </View>

                {/* Feature Highlights */}
                <View style={styles.featuresList}>
                  <FeatureItem
                    icon="shield-checkmark-outline"
                    iconColor={colors.cyan}
                    title="100% Temporaire"
                    desc="Arrêt automatique à l'arrivée ou à l'heure prévue. Aucun tracking résiduel."
                  />
                  <FeatureItem
                    icon="people-outline"
                    iconColor={colors.primary}
                    title="Cercles & Rendez-vous"
                    desc="Partagez en direct avec vos proches et suivez l'ETA de chacun."
                  />
                  <FeatureItem
                    icon="battery-charging-outline"
                    iconColor={colors.success}
                    title="Batterie & Données préservées"
                    desc="Le GPS s'active uniquement quand vous le décidez."
                  />
                </View>

                <View style={styles.trustFooter}>
                  <Ionicons name="lock-closed" size={14} color={colors.onNightMuted} />
                  <AppText variant="caption" color={colors.onNightMuted}>
                    Connexion chiffrée de bout en bout • Données hébergées en UE
                  </AppText>
                </View>
              </Animated.View>
            )}

            {/* Auth Form Card (Mobile full or Desktop right card) */}
            <View style={[styles.card, isDesktop && styles.desktopCard]}>
              {/* Mobile / Tablet Logo & Header */}
              {!isDesktop && (
                <>
                  <Animated.View entering={enter.fade()} style={styles.logo}>
                    <OrbitLogo size={110} />
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.badgeContainer}>
                    <View style={styles.badge}>
                      <View style={styles.badgeDot} />
                      <AppText variant="caption" color={colors.cyan} style={styles.badgeText}>
                        {badge}
                      </AppText>
                    </View>
                  </Animated.View>
                </>
              )}

              <Animated.View entering={FadeInDown.delay(140).duration(500)} style={styles.titles}>
                <AppText
                  variant={isDesktop ? "title" : "display"}
                  color={colors.onNight}
                  align={isDesktop ? "left" : "center"}
                  accessibilityRole="header"
                >
                  {title}
                </AppText>
                <AppText
                  variant="body"
                  color={colors.onNightMuted}
                  align={isDesktop ? "left" : "center"}
                >
                  {subtitle}
                </AppText>
              </Animated.View>

              <View style={styles.formContent}>{children}</View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function FeatureItem({
  icon,
  iconColor,
  title,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIconBox, { backgroundColor: `${iconColor}20`, borderColor: `${iconColor}40` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.featureTextCol}>
        <AppText variant="bodyStrong" color={colors.onNight}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.onNightMuted} style={styles.featureDesc}>
          {desc}
        </AppText>
      </View>
    </View>
  );
}

/** Wraps a form row so rows slide in one after the other. */
export function AuthRow({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(180 + index * 60).duration(400)}>{children}</Animated.View>;
}

// Background subtle cosmic glow
function NebulaGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
    </View>
  );
}

// Deterministic "random" stars: same sky on every render.
const STARS = Array.from({ length: 45 }, (_, i) => ({
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  mainContainer: {
    width: "100%",
    maxWidth: 440,
    justifyContent: "center",
  },
  desktopContainer: {
    maxWidth: 1040,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 56,
    paddingVertical: 24,
  },
  showcasePanel: {
    flex: 1.1,
    gap: 28,
    paddingRight: 12,
  },
  showcaseLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  showcaseBrand: {
    gap: 2,
  },
  brandTagline: {
    letterSpacing: 1.5,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  showcasePitch: {
    gap: 10,
  },
  showcaseHeading: {
    fontSize: 26,
    lineHeight: 34,
  },
  featuresList: {
    gap: 18,
    marginVertical: 4,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  featureTextCol: {
    flex: 1,
    gap: 3,
  },
  featureDesc: {
    lineHeight: 18,
  },
  trustFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  card: {
    width: "100%",
    gap: 14,
  },
  desktopCard: {
    flex: 0.9,
    maxWidth: 460,
    backgroundColor: "rgba(17, 24, 48, 0.75)",
    padding: 36,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    ...shadows.lg,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }
      : {}),
  },
  logo: {
    alignItems: "center",
    marginBottom: 2,
  },
  badgeContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.25)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  titles: {
    gap: 6,
    marginBottom: 16,
  },
  formContent: {
    gap: 14,
  },
  glowTopRight: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(108, 92, 231, 0.18)",
    ...(Platform.OS === "web" ? { filter: "blur(80px)" } : {}),
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    ...(Platform.OS === "web" ? { filter: "blur(80px)" } : {}),
  },
});
