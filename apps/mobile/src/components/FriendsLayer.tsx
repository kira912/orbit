import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { FriendLocation } from "@orbit/shared";
import { isStale, memberColor, memberInitials } from "../lib/member-display";

const LOW_BATTERY = 0.2;
const STALE_COLOR = "#9ca3af";
// Must be a font served by the basemap style (OpenFreeMap "liberty").
const FONT_BOLD = ["Noto Sans Bold"];

interface FriendsLayerProps {
  locations: FriendLocation[];
  selectedUserId: string | null;
  now: number;
  onSelect: (userId: string) => void;
}

/**
 * Circle members drawn as native map layers (colored avatar with initials,
 * first name above, battery badge). Native layers rather than view-based
 * <Marker>s because Marker onPress is unreliable on physical Android devices,
 * while source presses go through the map's own hit-testing.
 */
export function FriendsLayer({ locations, selectedUserId, now, onSelect }: FriendsLayerProps) {
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: locations.map((loc) => {
        const lowBattery =
          loc.batteryLevel != null && loc.batteryLevel <= LOW_BATTERY && !loc.batteryCharging;
        return {
          type: "Feature",
          id: loc.userId,
          geometry: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
          properties: {
            userId: loc.userId,
            initials: memberInitials(loc.displayName),
            firstName: loc.displayName.trim().split(/\s+/)[0] ?? loc.displayName,
            color: isStale(loc.recordedAt, now) ? STALE_COLOR : memberColor(loc.userId),
            selected: loc.userId === selectedUserId,
            badge: lowBattery ? "#dc2626" : loc.batteryCharging ? "#16a34a" : "",
          },
        };
      }),
    }),
    [locations, selectedUserId, now],
  );

  return (
    <GeoJSONSource
      id="friends"
      data={data}
      onPress={(event) => {
        const userId = event.nativeEvent.features[0]?.properties?.userId;
        if (typeof userId === "string") {
          event.stopPropagation();
          onSelect(userId);
        }
      }}
    >
      <Layer
        id="friends-selected-halo"
        type="circle"
        filter={["==", ["get", "selected"], true]}
        paint={{ "circle-radius": 30, "circle-color": ["get", "color"], "circle-opacity": 0.25 }}
      />
      <Layer
        id="friends-avatar"
        type="circle"
        paint={{
          "circle-radius": ["case", ["get", "selected"], 22, 18],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        }}
      />
      <Layer
        id="friends-badge"
        type="circle"
        filter={["!=", ["get", "badge"], ""]}
        paint={{
          "circle-radius": 7,
          "circle-color": ["get", "badge"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-translate": [14, 14],
        }}
      />
      <Layer
        id="friends-initials"
        type="symbol"
        layout={{
          "text-field": ["get", "initials"],
          "text-font": FONT_BOLD,
          "text-size": 13,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }}
        paint={{ "text-color": "#ffffff" }}
      />
      <Layer
        id="friends-name"
        type="symbol"
        layout={{
          "text-field": ["get", "firstName"],
          "text-font": FONT_BOLD,
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -2.2],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }}
        paint={{
          "text-color": "#111827",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        }}
      />
    </GeoJSONSource>
  );
}
