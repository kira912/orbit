import { z } from "zod";

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type GeoPointDto = z.infer<typeof geoPointSchema>;

export const locationPingInputSchema = geoPointSchema.extend({
  accuracy: z.number().nonnegative().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  /** 0..1, null when the device doesn't report it. */
  batteryLevel: z.number().min(0).max(1).nullable().optional(),
  batteryCharging: z.boolean().nullable().optional(),
  recordedAt: z.coerce.date(),
});
export type LocationPingInput = z.infer<typeof locationPingInputSchema>;

export const locationPingSchema = locationPingInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
export type LocationPing = z.infer<typeof locationPingSchema>;

/** Broadcast to circle members when one member's position updates. */
export const friendLocationSchema = locationPingSchema.extend({
  circleId: z.string().uuid(),
  displayName: z.string(),
});
export type FriendLocation = z.infer<typeof friendLocationSchema>;

export const locationHistoryQuerySchema = z.object({
  userId: z.string().uuid(),
  circleId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type LocationHistoryQuery = z.infer<typeof locationHistoryQuerySchema>;

export const latestLocationsQuerySchema = z.object({
  circleId: z.string().uuid(),
});
export type LatestLocationsQuery = z.infer<typeof latestLocationsQuerySchema>;
