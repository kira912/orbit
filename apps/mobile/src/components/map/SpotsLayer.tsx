import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GeoJSONSource, Layer, Marker } from "@maplibre/maplibre-react-native";
import { SPOT_CATEGORIES, type Spot } from "@orbit/shared";
import { colors, shadows } from "../../theme";
import { AppText } from "../ui";

interface SpotsLayerProps {
  spots: Spot[];
  selectedId: string | null;
  onSelect: (spotId: string) => void;
}

export function SpotsLayer({ spots, selectedId, onSelect }: SpotsLayerProps) {
  const hitAreas = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: spots.map((s) => ({
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: { spotId: s.id },
      })),
    }),
    [spots],
  );

  return (
    <>
      <GeoJSONSource
        id="map-spots"
        data={hitAreas}
        onPress={(event) => {
          const spotId = event.nativeEvent.features[0]?.properties?.spotId;
          if (typeof spotId === "string") {
            event.stopPropagation();
            onSelect(spotId);
          }
        }}
      >
        <Layer
          id="map-spots-hit"
          type="circle"
          paint={{
            "circle-radius": 24,
            "circle-color": "#000000",
            "circle-opacity": 0.01,
            "circle-translate": [0, -18],
          }}
        />
      </GeoJSONSource>
      {spots.map((spot) => {
        const meta = SPOT_CATEGORIES[spot.category] ?? SPOT_CATEGORIES.secret_place;
        const selected = spot.id === selectedId;
        return (
          <Marker
            key={spot.id}
            id={`spot-${spot.id}`}
            lngLat={[spot.longitude, spot.latitude]}
            anchor="bottom"
            pointerEvents="none"
          >
            <View pointerEvents="none" style={styles.pin}>
              {selected && (
                <View style={styles.titleBubble}>
                  <AppText variant="caption" style={styles.titleText} numberOfLines={1}>
                    {spot.title}
                  </AppText>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: meta.color },
                  selected && styles.selected,
                ]}
              >
                <Ionicons
                  name={meta.icon as keyof typeof Ionicons.glyphMap}
                  size={selected ? 22 : 18}
                  color={colors.onNight}
                />
                {spot.likesCount > 0 && (
                  <View style={styles.badge}>
                    <Ionicons name="heart" size={9} color="#FF4D6D" />
                    <AppText variant="caption" style={styles.badgeText}>
                      {spot.likesCount}
                    </AppText>
                  </View>
                )}
              </View>
              <View style={[styles.tip, { borderTopColor: meta.color }]} />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: "center" },
  titleBubble: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 4,
    maxWidth: 160,
    ...shadows.md,
  },
  titleText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: colors.surface,
    ...shadows.md,
  },
  selected: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3.5,
    borderColor: colors.primary,
    ...shadows.lg,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.sm,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "700",
    color: colors.ink,
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
