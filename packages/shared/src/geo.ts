export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
/** Assumed walking pace, used to estimate an ETA when we have no live speed reading. */
const DEFAULT_WALKING_SPEED_MPS = 1.4;
/** Below this speed a GPS reading is noise, not intentional travel. */
const MIN_RELIABLE_SPEED_MPS = 0.5;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Great-circle distance between two points, in meters. */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(
  point: GeoPoint,
  center: GeoPoint,
  radiusMeters: number,
): boolean {
  return haversineDistanceMeters(point, center) <= radiusMeters;
}

/**
 * Rough ETA in seconds. Uses the traveler's current speed when it looks like
 * genuine movement, otherwise falls back to an assumed walking pace.
 * This is a straight-line heuristic (no routing/road network), good enough for
 * an MVP "should I leave now" signal, not turn-by-turn navigation.
 */
export function estimateEtaSeconds(
  distanceMeters: number,
  currentSpeedMps: number | null | undefined,
): number {
  const speed =
    currentSpeedMps != null && currentSpeedMps >= MIN_RELIABLE_SPEED_MPS
      ? currentSpeedMps
      : DEFAULT_WALKING_SPEED_MPS;

  return distanceMeters / speed;
}

/** Point reached by travelling `distanceMeters` from `origin` along `bearingDegrees` (0 = north, clockwise). */
export function destinationPoint(
  origin: GeoPoint,
  distanceMeters: number,
  bearingDegrees: number,
): GeoPoint {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { latitude: toDegrees(lat2), longitude: toDegrees(lon2) };
}

/**
 * Approximates a geofence radius as a closed polygon ring (first point
 * repeated last, as GeoJSON requires) so it can be drawn on a vector map
 * that has no native "circle in meters" primitive (MapLibre's CircleLayer
 * radius is in pixels, not meters).
 */
export function circlePolygon(
  center: GeoPoint,
  radiusMeters: number,
  segments = 32,
): GeoPoint[] {
  const ring: GeoPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (360 * i) / segments;
    ring.push(destinationPoint(center, radiusMeters, bearing));
  }
  return ring;
}
