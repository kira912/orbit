import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Orbit's design tokens. Night-sky inks with a violet → cyan "orbit" accent;
 * light surfaces in the app, dark ones for auth and moments that matter
 * (active share, arrivals). Members keep their own hues (lib/member-display).
 */
export const colors = {
  ink: "#0B1020",
  ink2: "#3D4459",
  muted: "#7C8399",
  faint: "#B4B9C8",
  line: "rgba(11,16,32,0.08)",

  bg: "#F4F5F9",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF0F6",
  glass: "rgba(255,255,255,0.94)",

  night: "#0B1020",
  night2: "#141A31",
  night3: "#1E2645",
  onNight: "#FFFFFF",
  onNightMuted: "rgba(255,255,255,0.62)",

  primary: "#6C5CE7",
  primarySoft: "rgba(108,92,231,0.12)",
  cyan: "#22D3EE",
  success: "#10B981",
  successSoft: "rgba(16,185,129,0.12)",
  warning: "#F59E0B",
  warningSoft: "rgba(245,158,11,0.14)",
  danger: "#EF4444",
  dangerSoft: "rgba(239,68,68,0.12)",
} as const;

export const gradients = {
  orbit: ["#7C5CFF", "#5B6CF0", "#22D3EE"] as const,
  night: ["#0B1020", "#161D3A", "#24184A"] as const,
  sunset: ["#FF7A59", "#FF4F8B"] as const,
  success: ["#10B981", "#22D3EE"] as const,
};

export const fonts = {
  regular: "PlusJakartaSans_500Medium",
  medium: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  heavy: "PlusJakartaSans_800ExtraBold",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  display: { fontFamily: fonts.heavy, fontSize: 34, letterSpacing: -0.8, lineHeight: 40 },
  title: { fontFamily: fonts.heavy, fontSize: 26, letterSpacing: -0.5, lineHeight: 32 },
  headline: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  metric: { fontFamily: fonts.heavy, fontSize: 28, letterSpacing: -0.8, lineHeight: 32 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

function shadow(elevation: number, opacity: number, radiusPx: number, offsetY: number): ViewStyle {
  return Platform.select({
    android: { elevation, shadowColor: colors.ink },
    default: {
      shadowColor: colors.ink,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
  }) as ViewStyle;
}

export const shadows = {
  sm: shadow(2, 0.06, 6, 2),
  md: shadow(6, 0.1, 14, 6),
  lg: shadow(14, 0.16, 28, 12),
  glow: {
    ...shadow(10, 0.35, 18, 8),
    shadowColor: colors.primary,
  } as ViewStyle,
};

/**
 * Shared spring configs, so motion feels the same everywhere. Damping ratios
 * stay close to 1: things settle with at most a hint of overshoot instead of
 * bouncing (ratio = damping / (2 * sqrt(stiffness * mass))).
 */
export const springs = {
  /** ~0.9: indicators, sheets following the finger. */
  snappy: { damping: 24, stiffness: 260, mass: 0.7 },
  /** ~0.95: sheets opening. */
  gentle: { damping: 22, stiffness: 140 },
  /** ~0.8: press release, a touch of life without a visible bounce. */
  bouncy: { damping: 21, stiffness: 180 },
} as const;
