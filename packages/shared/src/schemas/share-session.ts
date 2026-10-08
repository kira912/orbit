import { z } from "zod";
import { geoPointSchema } from "./location";

/**
 * Why the circle is being alerted about a trip:
 * - late: not arrived well after the expected time;
 * - stalled: not moving for a while, far from the destination;
 * - silent: no position received for a while (dead phone, no network).
 */
export const safetyAlertKindSchema = z.enum(["late", "stalled", "silent"]);
export type SafetyAlertKind = z.infer<typeof safetyAlertKindSchema>;

export const shareSessionStatusSchema = z.enum([
  "active",
  "arrived",
  "expired",
  "stopped",
]);
export type ShareSessionStatus = z.infer<typeof shareSessionStatusSchema>;

export const shareSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  circleId: z.string().uuid(),
  destination: geoPointSchema.nullable(),
  /** Human label of the destination ("Maison", a meetup name), for display only. */
  destinationName: z.string().nullable(),
  arrivalRadiusMeters: z.number().positive().nullable(),
  expiresAt: z.coerce.date().nullable(),
  status: shareSessionStatusSchema,
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  /** Set when the session can be followed without the app, at /s/:publicToken. */
  publicToken: z.string().nullable(),
  meetupId: z.string().uuid().nullable(),
  /** "Rentre bien" is on for this trip. */
  safetyAlerts: z.boolean(),
  expectedArrivalAt: z.coerce.date().nullable(),
  /** The alert currently raised (not yet answered by "tout va bien"), if any. */
  alert: safetyAlertKindSchema.nullable(),
});
export type ShareSession = z.infer<typeof shareSessionSchema>;

/** A circle member's session, as seen by the rest of the circle. */
export const circleShareSessionSchema = shareSessionSchema
  .omit({ publicToken: true })
  .extend({ displayName: z.string() });
export type CircleShareSession = z.infer<typeof circleShareSessionSchema>;

export const startShareSessionInputSchema = z.object({
  circleId: z.string().uuid(),
  destination: geoPointSchema.optional(),
  destinationName: z.string().min(1).max(80).optional(),
  arrivalRadiusMeters: z.number().positive().max(2000).optional(),
  durationMinutes: z.number().positive().max(24 * 60).optional(),
  /** Also create a link people without the app can open in a browser. */
  publicLink: z.boolean().optional(),
  /** "Rentre bien": alert the circle if I'm late, stuck or silent. */
  safetyAlerts: z.boolean().optional(),
});
export type StartShareSessionInput = z.infer<
  typeof startShareSessionInputSchema
>;

/** Pushed over the socket while a session with a destination is active. */
export const sessionEtaUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  distanceMeters: z.number().nonnegative(),
  etaSeconds: z.number().nonnegative(),
});
export type SessionEtaUpdate = z.infer<typeof sessionEtaUpdateSchema>;

export const sessionStartedSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
});
export type SessionStarted = z.infer<typeof sessionStartedSchema>;

export const sessionEndedSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  status: shareSessionStatusSchema,
});
export type SessionEnded = z.infer<typeof sessionEndedSchema>;

/**
 * What a browser sees at /s/:token: only what the session itself shares, and
 * no position at all once it has ended.
 */
export const publicShareSessionSchema = z.object({
  displayName: z.string(),
  status: shareSessionStatusSchema,
  startedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  destination: geoPointSchema.nullable(),
  destinationName: z.string().nullable(),
  position: geoPointSchema
    .extend({
      accuracy: z.number().nullable(),
      recordedAt: z.coerce.date(),
      batteryLevel: z.number().nullable(),
    })
    .nullable(),
  distanceMeters: z.number().nullable(),
  etaSeconds: z.number().nullable(),
});
export type PublicShareSession = z.infer<typeof publicShareSessionSchema>;

/** Pushed to the circle when a "Rentre bien" alert is raised, or cleared ("ok"). */
export const sessionAlertSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  kind: z.union([safetyAlertKindSchema, z.literal("ok")]),
  destinationName: z.string().nullable(),
});
export type SessionAlert = z.infer<typeof sessionAlertSchema>;
