import { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SPOT_CATEGORIES,
  type Spot,
  type SpotCategory,
  type SpotVisibility,
} from "@orbit/shared";
import {
  useSpots,
  useToggleLikeSpot,
  useToggleSaveSpot,
} from "../../hooks/useSpots";
import { useCircles } from "../../hooks/useCircles";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { useAuthStore } from "../../lib/auth-store";
import { useNow } from "../../hooks/useNow";
import { formatRelativeTime } from "../../lib/member-display";
import { useTabBarClearance } from "../../components/TabBar";
import { SpotSheet } from "../../components/map/SpotSheet";
import { CreateSpotSheet } from "../../components/map/CreateSpotSheet";
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  PressableScale,
  ScreenHeader,
} from "../../components/ui";
import { colors, radius, shadows, enter } from "../../theme";

type FilterTab = "all" | "circle" | "public" | "saved" | "mine";

const CATEGORIES_LIST: SpotCategory[] = [
  "secret_place",
  "viewpoint",
  "photo",
  "cafe_bar",
  "nature",
  "culture",
  "food",
  "activity",
  "chill",
];

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const user = useAuthStore((s) => s.user);
  const now = useNow();

  const circleId = useActiveCircleStore((s) => s.circleId);
  const { data: circles } = useCircles();
  const circle = circles?.find((c) => c.id === circleId);

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedCategory, setSelectedCategory] = useState<SpotCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isCreatingSpot, setIsCreatingSpot] = useState(false);

  const toggleLike = useToggleLikeSpot();
  const toggleSave = useToggleSaveSpot();

  const queryParams = useMemo(() => {
    return {
      circleId: filterTab === "circle" ? circleId ?? undefined : undefined,
      visibility: filterTab === "public" ? ("public" as SpotVisibility) : undefined,
      category: selectedCategory ?? undefined,
      search: searchQuery.trim() || undefined,
      savedOnly: filterTab === "saved" ? true : undefined,
      mySpotsOnly: filterTab === "mine" ? true : undefined,
    };
  }, [filterTab, circleId, selectedCategory, searchQuery]);

  const { data: spots, isLoading, isRefetching, refetch } = useSpots(queryParams);

  return (
    <View style={styles.container}>
      <FlatList
        data={spots ?? []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: clearance + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.titleRow}>
              <ScreenHeader
                eyebrow={circle?.name ? `Pépites · ${circle.name}` : "Réseau social"}
                title="Lieux secrets & Pépites"
              />
              <IconButton
                icon="add"
                background={colors.primarySoft}
                color={colors.primary}
                size={42}
                accessibilityLabel="Partager une pépite"
                onPress={() => setIsCreatingSpot(true)}
              />
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un spot, un tag, une ville..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <IconButton
                  icon="close-circle"
                  size={26}
                  color={colors.muted}
                  accessibilityLabel="Effacer la recherche"
                  onPress={() => setSearchQuery("")}
                />
              )}
            </View>

            {/* Filter Tabs: Tous, Cercle, Public, Favoris, Mes spots */}
            <View style={styles.tabsRow}>
              <FilterPill
                label="Tout"
                icon="sparkles"
                active={filterTab === "all"}
                onPress={() => setFilterTab("all")}
              />
              <FilterPill
                label="Mon Cercle"
                icon="people"
                active={filterTab === "circle"}
                onPress={() => setFilterTab("circle")}
              />
              <FilterPill
                label="Public"
                icon="globe"
                active={filterTab === "public"}
                onPress={() => setFilterTab("public")}
              />
              <FilterPill
                label="Favoris"
                icon="bookmark"
                active={filterTab === "saved"}
                onPress={() => setFilterTab("saved")}
              />
              <FilterPill
                label="Mes spots"
                icon="person"
                active={filterTab === "mine"}
                onPress={() => setFilterTab("mine")}
              />
            </View>

            {/* Categories Carousel */}
            <FlatList
              horizontal
              data={CATEGORIES_LIST}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              renderItem={({ item }) => {
                const meta = SPOT_CATEGORIES[item];
                const active = selectedCategory === item;
                return (
                  <PressableScale
                    style={[
                      styles.categoryChip,
                      active && { backgroundColor: meta.color, borderColor: meta.color },
                    ]}
                    onPress={() =>
                      setSelectedCategory(active ? null : item)
                    }
                    scaleTo={0.94}
                  >
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? colors.onNight : meta.color}
                    />
                    <AppText
                      variant="caption"
                      style={[styles.categoryText, active && styles.categoryTextActive]}
                    >
                      {meta.label}
                    </AppText>
                  </PressableScale>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="sparkles-outline"
              title="Aucune pépite trouvée"
              message="Sois le premier à partager un endroit secret avec ton cercle ou la communauté !"
              action={
                <Button
                  label="Partager une pépite"
                  icon="sparkles"
                  onPress={() => setIsCreatingSpot(true)}
                />
              }
            />
          ) : null
        }
        renderItem={({ item, index }) => {
          const meta = SPOT_CATEGORIES[item.category] ?? SPOT_CATEGORIES.secret_place;
          const isMine = item.createdById === user?.id;

          return (
            <Animated.View entering={enter.up(Math.min(index, 6) * 40)}>
              <PressableScale
                style={styles.card}
                onPress={() => setSelectedSpot(item)}
                scaleTo={0.98}
              >
                {/* Card Top: Author + Category Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.authorRow}>
                    <Avatar
                      userId={item.createdById}
                      name={item.creatorDisplayName}
                      pictureUrl={item.creatorPictureUrl}
                      size={32}
                    />
                    <View>
                      <AppText variant="caption" style={{ fontWeight: "700" }}>
                        {isMine ? "Toi" : item.creatorDisplayName}
                      </AppText>
                      <AppText variant="caption" color={colors.muted} style={{ fontSize: 11 }}>
                        {formatRelativeTime(item.createdAt, now)}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: meta.color + "18" },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={12}
                      color={meta.color}
                    />
                    <AppText
                      variant="caption"
                      style={[styles.categoryBadgeText, { color: meta.color }]}
                    >
                      {meta.label}
                    </AppText>
                  </View>
                </View>

                {/* Spot Title & Address */}
                <AppText variant="title" style={styles.cardTitle}>
                  {item.title}
                </AppText>

                {item.address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <AppText
                      variant="caption"
                      color={colors.ink2}
                      numberOfLines={1}
                      style={styles.flex}
                    >
                      {item.address}
                    </AppText>
                  </View>
                )}

                {/* Description snippet */}
                {item.description ? (
                  <View style={styles.descriptionBox}>
                    <Ionicons name="sparkles" size={12} color={colors.primary} />
                    <AppText
                      variant="body"
                      color={colors.ink2}
                      numberOfLines={2}
                      style={styles.flex}
                    >
                      {item.description}
                    </AppText>
                  </View>
                ) : null}

                {/* Tags */}
                {item.tags && item.tags.length > 0 ? (
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tagBadge}>
                        <AppText variant="caption" color={colors.muted} style={{ fontSize: 11 }}>
                          #{tag}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Footer: Likes, Comments, Visibility, Save */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerLeft}>
                    {/* Like button */}
                    <PressableScale
                      style={[
                        styles.statPill,
                        item.isLikedByMe && { backgroundColor: "#FFE5EC" },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleLike.mutate(item.id);
                      }}
                      scaleTo={0.9}
                    >
                      <Ionicons
                        name={item.isLikedByMe ? "heart" : "heart-outline"}
                        size={16}
                        color={item.isLikedByMe ? "#FF4D6D" : colors.muted}
                      />
                      <AppText
                        variant="caption"
                        color={item.isLikedByMe ? "#FF4D6D" : colors.muted}
                        style={{ fontWeight: "700" }}
                      >
                        {item.likesCount}
                      </AppText>
                    </PressableScale>

                    {/* Comments button */}
                    <View style={styles.statPill}>
                      <Ionicons name="chatbubble-outline" size={15} color={colors.muted} />
                      <AppText variant="caption" color={colors.muted} style={{ fontWeight: "600" }}>
                        {item.commentsCount}
                      </AppText>
                    </View>

                    {/* Visibility */}
                    <View style={styles.visibilityChip}>
                      <Ionicons
                        name={item.visibility === "public" ? "globe-outline" : "lock-closed-outline"}
                        size={12}
                        color={colors.muted}
                      />
                      <AppText variant="caption" color={colors.muted} style={{ fontSize: 11 }}>
                        {item.visibility === "public"
                          ? "Public"
                          : item.circleName ?? "Cercle"}
                      </AppText>
                    </View>
                  </View>

                  {/* Bookmark Save */}
                  <PressableScale
                    style={styles.saveBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleSave.mutate(item.id);
                    }}
                    scaleTo={0.88}
                  >
                    <Ionicons
                      name={item.isSavedByMe ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={item.isSavedByMe ? colors.primary : colors.muted}
                    />
                  </PressableScale>
                </View>
              </PressableScale>
            </Animated.View>
          );
        }}
      />

      {/* Spot Detail Sheet */}
      <SpotSheet
        spot={selectedSpot}
        myId={user?.id}
        onClose={() => setSelectedSpot(null)}
      />

      {/* Create Spot Sheet */}
      <CreateSpotSheet
        visible={isCreatingSpot}
        coordinates={null}
        circleId={circleId}
        onClose={() => setIsCreatingSpot(false)}
      />
    </View>
  );
}

function FilterPill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
      scaleTo={0.94}
    >
      <Ionicons
        name={icon}
        size={13}
        color={active ? colors.onNight : colors.ink}
      />
      <AppText
        variant="caption"
        style={[styles.filterPillText, active && styles.filterPillTextActive]}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, gap: 12 },
  headerArea: { gap: 12, marginBottom: 4 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    height: "100%",
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterPillActive: {
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  filterPillTextActive: {
    color: colors.onNight,
  },
  categoriesList: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  categoryTextActive: {
    color: colors.onNight,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  descriptionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.bg,
    padding: 8,
    borderRadius: radius.md,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tagBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  visibilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  saveBtn: {
    padding: 6,
  },
});
