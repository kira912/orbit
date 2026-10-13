import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SPOT_CATEGORIES,
  type SpotCategory,
  type SpotVisibility,
} from "@orbit/shared";
import { colors, radius, shadows } from "../../theme";
import { AppText, PressableScale } from "../ui";

interface SpotsFilterBarProps {
  selectedCategory: SpotCategory | null;
  onSelectCategory: (category: SpotCategory | null) => void;
  selectedVisibility: SpotVisibility | null;
  onSelectVisibility: (visibility: SpotVisibility | null) => void;
  onCreateSpot: () => void;
  showSpots: boolean;
  onToggleShowSpots: () => void;
}

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

export function SpotsFilterBar({
  selectedCategory,
  onSelectCategory,
  selectedVisibility,
  onSelectVisibility,
  onCreateSpot,
  showSpots,
  onToggleShowSpots,
}: SpotsFilterBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Toggle Spots Layer */}
        <PressableScale
          style={[
            styles.chip,
            styles.toggleChip,
            showSpots && styles.activeChip,
          ]}
          onPress={onToggleShowSpots}
          scaleTo={0.94}
        >
          <Ionicons
            name={showSpots ? "sparkles" : "sparkles-outline"}
            size={15}
            color={showSpots ? colors.onNight : colors.ink}
          />
          <AppText
            variant="caption"
            style={[
              styles.chipText,
              showSpots && styles.activeChipText,
            ]}
          >
            Pépites
          </AppText>
        </PressableScale>

        {showSpots && (
          <>
            {/* Add Spot button */}
            <PressableScale
              style={[styles.chip, styles.addChip]}
              onPress={onCreateSpot}
              scaleTo={0.94}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <AppText
                variant="caption"
                style={[styles.chipText, { color: colors.primary, fontWeight: "700" }]}
              >
                Partager
              </AppText>
            </PressableScale>

            {/* Visibility Toggle: All / Circle / Public */}
            <PressableScale
              style={[
                styles.chip,
                selectedVisibility === null && styles.activeChip,
              ]}
              onPress={() => onSelectVisibility(null)}
              scaleTo={0.94}
            >
              <AppText
                variant="caption"
                style={[
                  styles.chipText,
                  selectedVisibility === null && styles.activeChipText,
                ]}
              >
                Tout
              </AppText>
            </PressableScale>

            <PressableScale
              style={[
                styles.chip,
                selectedVisibility === "circle" && styles.activeChip,
              ]}
              onPress={() =>
                onSelectVisibility(selectedVisibility === "circle" ? null : "circle")
              }
              scaleTo={0.94}
            >
              <Ionicons
                name="people"
                size={13}
                color={selectedVisibility === "circle" ? colors.onNight : colors.ink}
              />
              <AppText
                variant="caption"
                style={[
                  styles.chipText,
                  selectedVisibility === "circle" && styles.activeChipText,
                ]}
              >
                Cercle
              </AppText>
            </PressableScale>

            <PressableScale
              style={[
                styles.chip,
                selectedVisibility === "public" && styles.activeChip,
              ]}
              onPress={() =>
                onSelectVisibility(selectedVisibility === "public" ? null : "public")
              }
              scaleTo={0.94}
            >
              <Ionicons
                name="globe"
                size={13}
                color={selectedVisibility === "public" ? colors.onNight : colors.ink}
              />
              <AppText
                variant="caption"
                style={[
                  styles.chipText,
                  selectedVisibility === "public" && styles.activeChipText,
                ]}
              >
                Public
              </AppText>
            </PressableScale>

            {/* Separator */}
            <View style={styles.divider} />

            {/* Category Chips */}
            {CATEGORIES_LIST.map((catKey) => {
              const meta = SPOT_CATEGORIES[catKey];
              const isSelected = selectedCategory === catKey;
              return (
                <PressableScale
                  key={catKey}
                  style={[
                    styles.chip,
                    isSelected && { backgroundColor: meta.color, borderColor: meta.color },
                  ]}
                  onPress={() =>
                    onSelectCategory(isSelected ? null : catKey)
                  }
                  scaleTo={0.94}
                >
                  <Ionicons
                    name={meta.icon as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={isSelected ? colors.onNight : meta.color}
                  />
                  <AppText
                    variant="caption"
                    style={[
                      styles.chipText,
                      isSelected && styles.activeChipText,
                    ]}
                  >
                    {meta.label}
                  </AppText>
                </PressableScale>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.sm,
  },
  toggleChip: {
    backgroundColor: colors.surface,
  },
  addChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary + "40",
  },
  activeChip: {
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  activeChipText: {
    color: colors.onNight,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.line,
    marginHorizontal: 2,
  },
});
