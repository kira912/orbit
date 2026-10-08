import { useEffect, useState, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import type { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, springs } from "../theme";
import { AppText, PressableScale, useOpenSheets } from "./ui";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
type IconName = ComponentProps<typeof Ionicons>["name"];

export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ["planet", "planet-outline"],
  circle: ["people", "people-outline"],
  activity: ["pulse", "pulse-outline"],
  profile: ["person-circle", "person-circle-outline"],
};

/** Height of the floating bar, for screens that must keep content clear of it. */
export const TAB_BAR_HEIGHT = 64;

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 16;
}

/** Floating night pill; a highlight slides under the active tab. */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabWidth = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(state.index * tabWidth, springs.snappy);
  }, [state.index, tabWidth, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  // Slides down out of the way while a bottom sheet is open.
  const sheetOpen = useOpenSheets((s) => s.count > 0);
  const hidden = useSharedValue(0);
  useEffect(() => {
    hidden.value = withSpring(sheetOpen ? 1 : 0, springs.snappy);
  }, [sheetOpen, hidden]);
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * (TAB_BAR_HEIGHT + 60) }],
    opacity: 1 - hidden.value,
  }));

  return (
    <Animated.View
      pointerEvents={sheetOpen ? "none" : "box-none"}
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) }, slide]}
    >
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 12)}>
        {width > 0 && <Animated.View style={[styles.indicator, { width: tabWidth }, indicator]} />}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const [active, inactive] = TAB_ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <PressableScale
              key={route.key}
              style={styles.tab}
              haptic="selection"
              scaleTo={0.9}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Ionicons name={focused ? active : inactive} size={22} color={focused ? colors.onNight : colors.onNightMuted} />
              <AppText
                variant="caption"
                color={focused ? colors.onNight : colors.onNightMuted}
                style={styles.label}
              >
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 16, right: 16 },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.night,
    ...shadows.lg,
  },
  indicator: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.night3,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, height: "100%" },
  label: { fontSize: 11, lineHeight: 14 },
});
