import { describe, expect, it } from "vitest";
import {
  circlePolygon,
  destinationPoint,
  estimateEtaSeconds,
  haversineDistanceMeters,
  isWithinRadius,
} from "./geo";

describe("haversineDistanceMeters", () => {
  it("returns 0 for identical points", () => {
    const point = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineDistanceMeters(point, point)).toBe(0);
  });

  it("matches the known Paris <-> London great-circle distance (~344km)", () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };

    const distance = haversineDistanceMeters(paris, london);

    expect(distance).toBeGreaterThan(340_000);
    expect(distance).toBeLessThan(348_000);
  });

  it("is symmetric", () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 34.0522, longitude: -118.2437 };

    expect(haversineDistanceMeters(a, b)).toBeCloseTo(
      haversineDistanceMeters(b, a),
      6,
    );
  });
});

describe("isWithinRadius", () => {
  const center = { latitude: 48.8566, longitude: 2.3522 };

  it("is true when the point is the center itself", () => {
    expect(isWithinRadius(center, center, 10)).toBe(true);
  });

  it("is false once the distance exceeds the radius", () => {
    const farAway = { latitude: 48.8566, longitude: 2.4522 };
    expect(isWithinRadius(farAway, center, 100)).toBe(false);
  });
});

describe("estimateEtaSeconds", () => {
  it("uses the current speed when it looks like real movement", () => {
    // 1000m at 10 m/s -> 100s
    expect(estimateEtaSeconds(1000, 10)).toBeCloseTo(100, 6);
  });

  it("falls back to a walking pace when speed is missing", () => {
    const eta = estimateEtaSeconds(1400, null);
    expect(eta).toBeCloseTo(1000, 0); // 1400m / 1.4 m/s
  });

  it("falls back to a walking pace when speed is noise (near-zero)", () => {
    const withNoise = estimateEtaSeconds(1400, 0.05);
    const withoutSpeed = estimateEtaSeconds(1400, undefined);
    expect(withNoise).toBeCloseTo(withoutSpeed, 6);
  });

  it("never returns a negative ETA for a zero distance", () => {
    expect(estimateEtaSeconds(0, 5)).toBe(0);
  });
});

describe("destinationPoint", () => {
  const origin = { latitude: 48.8566, longitude: 2.3522 };

  it("returns the origin for a zero distance", () => {
    const result = destinationPoint(origin, 0, 90);
    expect(result.latitude).toBeCloseTo(origin.latitude, 6);
    expect(result.longitude).toBeCloseTo(origin.longitude, 6);
  });

  it("moves north (bearing 0) by increasing latitude only", () => {
    const result = destinationPoint(origin, 1000, 0);
    expect(result.latitude).toBeGreaterThan(origin.latitude);
    expect(result.longitude).toBeCloseTo(origin.longitude, 6);
  });

  it("round-trips with haversineDistanceMeters for the requested distance", () => {
    const result = destinationPoint(origin, 500, 45);
    expect(haversineDistanceMeters(origin, result)).toBeCloseTo(500, 0);
  });
});

describe("circlePolygon", () => {
  const center = { latitude: 48.8566, longitude: 2.3522 };

  it("produces a closed ring (first point repeated last)", () => {
    const ring = circlePolygon(center, 150, 16);
    expect(ring).toHaveLength(17);
    expect(ring[0].latitude).toBeCloseTo(ring[16].latitude, 9);
    expect(ring[0].longitude).toBeCloseTo(ring[16].longitude, 9);
  });

  it("keeps every vertex at the requested radius from the center", () => {
    const radius = 200;
    const ring = circlePolygon(center, radius, 24);
    for (const point of ring) {
      expect(haversineDistanceMeters(center, point)).toBeCloseTo(radius, 0);
    }
  });
});
