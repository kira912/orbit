import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/**
 * Basemap: OpenFreeMap "positron" (free, no API key), a clean minimal style,
 * recolored at load time with a soft pastel palette so the members' saturated
 * colors pop on top of it. Only paint colors change: layers, fonts and tiles stay
 * OpenFreeMap's, so upstream fixes keep flowing in.
 */
export const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const PALETTE = {
  land: "#f6f3ee",
  residential: "#f1ede6",
  park: "#dcebd5",
  wood: "#d2e5ca",
  water: "#bcdcee",
  waterway: "#a9d1e8",
  building: "#ebe5dc",
  buildingOutline: "#ddd5c9",
  road: "#ffffff",
  roadCasing: "#e7dfd3",
  path: "#ece4d7",
  motorway: "#fde8cc",
  motorwayCasing: "#f2d1a5",
  rail: "#dcd4c8",
  boundary: "#cdbfdc",
  label: "#4a443e",
  labelMuted: "#8b8279",
  waterLabel: "#5a8db3",
  halo: "#f6f3ee",
};

/** Paint overrides keyed by positron layer id; unknown ids are ignored if the upstream style changes. */
const PAINT_OVERRIDES: Record<string, Record<string, unknown>> = {
  background: { "background-color": PALETTE.land },
  park: { "fill-color": PALETTE.park },
  water: { "fill-color": PALETTE.water },
  waterway: { "line-color": PALETTE.waterway },
  landuse_residential: { "fill-color": PALETTE.residential },
  landcover_wood: { "fill-color": PALETTE.wood },
  building: { "fill-color": PALETTE.building, "fill-outline-color": PALETTE.buildingOutline },
  road_area_pier: { "fill-color": PALETTE.land },
  road_pier: { "line-color": PALETTE.land },
  highway_path: { "line-color": PALETTE.path },
  highway_minor: { "line-color": PALETTE.road },
  highway_major_casing: { "line-color": PALETTE.roadCasing },
  highway_major_inner: { "line-color": PALETTE.road },
  highway_major_subtle: { "line-color": PALETTE.roadCasing },
  tunnel_motorway_casing: { "line-color": PALETTE.roadCasing },
  tunnel_motorway_inner: { "line-color": PALETTE.road },
  highway_motorway_casing: { "line-color": PALETTE.motorwayCasing },
  highway_motorway_inner: { "line-color": PALETTE.motorway },
  highway_motorway_subtle: { "line-color": PALETTE.motorwayCasing },
  highway_motorway_bridge_casing: { "line-color": PALETTE.motorwayCasing },
  highway_motorway_bridge_inner: { "line-color": PALETTE.motorway },
  railway: { "line-color": PALETTE.rail },
  railway_transit: { "line-color": PALETTE.rail },
  railway_service: { "line-color": PALETTE.rail },
  boundary_2: { "line-color": PALETTE.boundary },
  boundary_3: { "line-color": PALETTE.boundary },
  boundary_disputed: { "line-color": PALETTE.boundary },
  waterway_line_label: { "text-color": PALETTE.waterLabel, "text-halo-color": PALETTE.halo },
  water_name_point_label: { "text-color": PALETTE.waterLabel, "text-halo-color": PALETTE.halo },
  water_name_line_label: { "text-color": PALETTE.waterLabel, "text-halo-color": PALETTE.halo },
  "highway-name-path": { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  "highway-name-minor": { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  "highway-name-major": { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  airport: { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  label_other: { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  label_village: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_town: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_state: { "text-color": PALETTE.labelMuted, "text-halo-color": PALETTE.halo },
  label_city: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_city_capital: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_country_1: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_country_2: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
  label_country_3: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo },
};

/** Shown behind the map while the style loads, so the screen doesn't flash white. */
export const MAP_LOADING_COLOR = PALETTE.land;

export function applyPastelTheme(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const overrides = PAINT_OVERRIDES[layer.id];
      if (!overrides) return layer;
      return { ...layer, paint: { ...layer.paint, ...overrides } } as typeof layer;
    }),
  };
}

export async function fetchPastelStyle(signal?: AbortSignal): Promise<StyleSpecification> {
  const response = await fetch(BASE_STYLE_URL, { signal });
  if (!response.ok) throw new Error(`Map style failed (${response.status})`);
  return applyPastelTheme((await response.json()) as StyleSpecification);
}
