import { z } from "zod";
import { geoPointSchema } from "./location";

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
  arrivalRadiusMeters: z.number().positive().nullable(),
  expiresAt: z.coerce.date().nullable(),
  status: shareSessionStatusSchema,
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
});
export type ShareSession = z.infer<typeof shareSessionSchema>;

export const startShareSessionInputSchema = z.object({
  circleId: z.string().uuid(),
  destination: geoPointSchema.optional(),
  arrivalRadiusMeters: z.number().positive().max(2000).optional(),
  durationMinutes: z.number().positive().max(24 * 60).optional(),
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

export const sessionEndedSchema = z.object({
  sessionId: z.string().uuid(),
  status: shareSessionStatusSchema,
});
export type SessionEnded = z.infer<typeof sessionEndedSchema>;
