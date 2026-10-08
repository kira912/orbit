import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GeoJSONSource, Layer, Marker } from "@maplibre/maplibre-react-native";
import type { MapReport } from "@orbit/shared";
import { REPORT_KINDS } from "../../lib/report-kinds";
import { colors, shadows } from "../../theme";

interface ReportsLayerProps {
  reports: MapReport[];
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}

/**
 * Map reports: a colored pin per report (view-based, for the icon) over an
 * invisible native circle layer that takes the taps. Marker onPress is
 * unreliable on Android (see FriendsLayer), so the pins let touches through.
 */
export function ReportsLayer({ reports, selectedId, onSelect }: ReportsLayerProps) {
  const hitAreas = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: reports.map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: { type: "Point", coordinates: [r.longitude, r.latitude] },
        properties: { reportId: r.id },
      })),
    }),
    [reports],
  );

  return (
    <>
      <GeoJSONSource
        id="map-reports"
        data={hitAreas}
        onPress={(event) => {
          const reportId = event.nativeEvent.features[0]?.properties?.reportId;
          if (typeof reportId === "string") {
            event.stopPropagation();
            onSelect(reportId);
          }
        }}
      >
        <Layer
          id="map-reports-hit"
          type="circle"
          paint={{ "circle-radius": 22, "circle-color": "#000000", "circle-opacity": 0.01, "circle-translate": [0, -18] }}
        />
      </GeoJSONSource>
      {reports.map((report) => {
        const meta = REPORT_KINDS[report.kind];
        const selected = report.id === selectedId;
        return (
          <Marker
            key={report.id}
            id={`report-${report.id}`}
            lngLat={[report.longitude, report.latitude]}
            anchor="bottom"
            pointerEvents="none"
          >
            <View pointerEvents="none" style={styles.pin}>
              <View style={[styles.bubble, { backgroundColor: meta.color }, selected && styles.selected]}>
                <Ionicons name={meta.icon} size={selected ? 20 : 17} color={colors.onNight} />
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
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: colors.surface,
    ...shadows.md,
  },
  selected: { width: 42, height: 42, borderRadius: 21 },
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
