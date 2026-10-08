import { useMemo, type ComponentProps } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActivityItem } from "@orbit/shared";
import { formatClock, formatDay } from "../../lib/eta-format";
import { useActivity } from "../../hooks/useActivity";
import { REPORT_KINDS } from "../../lib/report-kinds";
import { useCircles } from "../../hooks/useCircles";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useTabBarClearance } from "../../components/TabBar";
import { AppText, Avatar, EmptyState, PressableScale, ScreenHeader } from "../../components/ui";
import { colors, radius, shadows, enter } from "../../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** The circle's last 7 days: arrivals, departures, shares, meetups, new members. */
export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: circles } = useCircles();
  const circle = circles?.find((c) => c.id === circleId);
  const { data: items, isLoading, isRefetching, refetch } = useActivity(circleId);

  const sections = useMemo(() => groupByDay(items ?? []), [items]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: clearance + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={<ScreenHeader eyebrow={circle?.name ?? "Activité"} title="Ce qui s'est passé" />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="pulse-outline"
              title="Rien pour l'instant"
              message="Les arrivées, départs et partages de ton cercle apparaîtront ici."
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" color={colors.muted} style={styles.section}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item, index, section }) => {
          const { icon, color, text } = describe(item);
          const last = index === section.data.length - 1;
          const onPress = item.kind === "meetup-created" ? () => router.push(`/meetup/${item.meetupId}`) : undefined;
          return (
            <Animated.View entering={enter.up(Math.min(index, 8) * 50)}>
              <PressableScale style={styles.item} onPress={onPress} disabled={!onPress} scaleTo={0.98} dimWhenDisabled={false}>
                <View style={styles.timeline}>
                  <View style={[styles.icon, { backgroundColor: color }]}>
                    <Ionicons name={icon} size={16} color={colors.onNight} />
                  </View>
                  {!last && <View style={styles.line} />}
                </View>
                <View style={styles.card}>
                  <Avatar userId={item.userId} name={item.displayName} size={34} />
                  <View style={styles.text}>
                    <AppText variant="body" numberOfLines={2}>
                      <AppText variant="bodyStrong">{item.displayName}</AppText> {text}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {formatClock(item.at)}
                    </AppText>
                  </View>
                  {onPress && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
                </View>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

function describe(item: ActivityItem): { icon: IconName; color: string; text: string } {
  switch (item.kind) {
    case "geofence":
      return item.type === "enter"
        ? { icon: "home", color: colors.success, text: `est arrivé·e à ${item.placeName}` }
        : { icon: "walk", color: colors.warning, text: `a quitté ${item.placeName}` };
    case "session-started":
      return {
        icon: "navigate",
        color: colors.primary,
        text: item.destinationName ? `a partagé son trajet vers ${item.destinationName}` : "a partagé sa position",
      };
    case "session-arrived":
      return {
        icon: "flag",
        color: colors.success,
        text: item.destinationName ? `est bien arrivé·e à ${item.destinationName}` : "est bien arrivé·e",
      };
    case "meetup-created":
      return { icon: "people", color: "#FF4F8B", text: `propose un rendez-vous : ${item.meetupName}` };
    case "member-joined":
      return { icon: "person-add", color: colors.cyan, text: `a rejoint ${item.circleName}` };
    case "safety-alert": {
      const where = item.destinationName ? ` à ${item.destinationName}` : "";
      const text = {
        late: `n'était pas arrivé·e${where} à l'heure prévue`,
        stalled: "ne bougeait plus depuis 10 min",
        silent: "n'envoyait plus sa position",
      }[item.alertKind];
      return { icon: "warning", color: colors.danger, text: `· Rentre bien : ${text}` };
    }
    case "map-report": {
      const meta = REPORT_KINDS[item.reportKind];
      return { icon: meta.icon, color: meta.color, text: `a signalé ${meta.phrase}${item.note ? ` : « ${item.note} »` : ""}` };
    }
    case "safety-ok":
      return { icon: "shield-checkmark", color: colors.success, text: "a indiqué que tout allait bien" };
  }
}

function groupByDay(items: ActivityItem[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const sections: { title: string; data: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = new Date(item.at).toDateString();
    const title =
      day === today
        ? "Aujourd'hui"
        : day === yesterday
          ? "Hier"
          : formatDay(item.at);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(item);
    else sections.push({ title, data: [item] });
  }
  return sections;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16 },
  section: { marginTop: 8, marginBottom: 10 },
  item: { flexDirection: "row", gap: 12 },
  timeline: { alignItems: "center", width: 32 },
  icon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 14 },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 4 },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    ...shadows.sm,
  },
  text: { flex: 1, gap: 2 },
});
