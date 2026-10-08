import { z } from "zod";

export type RouteProfile = "foot" | "car";

/** Deep navy: distinct from the member palette, so a route never looks like a trajectory. */
export const ROUTE_COLOR = "#1e3a8a";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Route {
  /** [longitude, latitude] pairs, ready for a GeoJSON LineString. */
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

// Public OSRM instances run by FOSSGIS on OpenStreetMap data: free, no API key, one per profile.
// The "driving" segment is ignored by these servers, the profile comes from the host path.
const ROUTERS: Record<RouteProfile, string> = {
  foot: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
  car: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
};

const osrmResponseSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
      }),
    )
    .optional(),
});

/** Fastest route between two points; throws when the router is unreachable or finds no route. */
export async function fetchRoute(from: LatLng, to: LatLng, profile: RouteProfile, signal?: AbortSignal): Promise<Route> {
  const points = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response = await fetch(`${ROUTERS[profile]}/${points}?overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const body = osrmResponseSchema.parse(await response.json());
  const route = body.routes?.[0];
  if (body.code !== "Ok" || !route) throw new Error(`No route (${body.code})`);
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
