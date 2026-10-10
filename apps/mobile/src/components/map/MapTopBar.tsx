import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CircleWithMembers, FriendLocation } from "@orbit/shared";
import { isStale } from "../../lib/member-display";
import { colors, radius, shadows, enter } from "../../theme";
import { AppText, Avatar, AvatarStack, PressableScale } from "../ui";

interface MapTopBarProps {
  circle: CircleWithMembers | null;
  myId: string | undefined;
  locations: Record<string, FriendLocation>;
  now: number;
  selectedUserId: string | null;
  onOpenCircles: () => void;
  onSelectMember: (userId: string) => void;
}

/** Circle switcher and a strip of the members, floating over the top of the map. */
export function MapTopBar({ circle, myId, locations, now, selectedUserId, onOpenCircles, onSelectMember }: MapTopBarProps) {
  const insets = useSafeAreaInsets();
  const others = circle?.members.filter((m) => m.userId !== myId) ?? [];

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <PressableScale style={styles.switcher} onPress={onOpenCircles} scaleTo={0.97}>
          {circle ? (
            <AvatarStack members={circle.members} size={26} max={3} />
          ) : (
            <Ionicons name="planet" size={22} color={colors.primary} />
          )}
          <View style={styles.switcherText}>
            <AppText variant="label" color={colors.muted}>
              Cercle
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {circle?.name ?? "Choisir un cercle"}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.ink2} />
        </PressableScale>
      </Animated.View>

      {others.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {others.map((member, index) => {
            const location = locations[member.userId];
            const stale = !location || isStale(location.recordedAt, now);
            const selected = member.userId === selectedUserId;
            return (
              <Animated.View key={member.userId} entering={enter.right(80 * index)}>
                <PressableScale
                  style={[styles.member, selected && styles.memberSelected]}
                  onPress={() => onSelectMember(member.userId)}
                  disabled={!location}
                  accessibilityLabel={member.displayName}
                >
                  <Avatar
                    userId={member.userId}
                    name={member.displayName}
                    pictureUrl={member.pictureUrl}
                    size={30}
                    color={stale ? colors.faint : undefined}
                    presence={location ? (stale ? "stale" : "live") : null}
                  />
                  <AppText variant="bodyStrong" style={styles.memberName} numberOfLines={1}>
                    {member.displayName.split(" ")[0]}
                  </AppText>
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 0, left: 0, right: 0, gap: 10 },
  switcher: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.glass,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    maxWidth: "80%",
    ...shadows.md,
  },
  switcherText: { flexShrink: 1 },
  strip: { paddingHorizontal: 16, gap: 8 },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.glass,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadows.sm,
  },
  memberSelected: { borderColor: colors.primary },
  memberName: { fontSize: 14 },
});
