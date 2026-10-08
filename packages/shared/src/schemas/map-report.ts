import { z } from "zod";
import { geoPointSchema } from "./location";

export const mapReportKindSchema = z.enum(["danger", "accident", "traffic", "roadwork", "closed", "other"]);
export type MapReportKind = z.infer<typeof mapReportKindSchema>;

/**
 * How long a report stays on the map unless someone confirms it (each
 * "toujours là" restarts the clock). Short-lived things fade quickly.
 */
export const MAP_REPORT_TTL_MINUTES: Record<MapReportKind, number> = {
  danger: 4 * 60,
  accident: 2 * 60,
  traffic: 60,
  roadwork: 7 * 24 * 60,
  closed: 24 * 60,
  other: 6 * 60,
};

/** Kinds worth a push notification; the others only show on the map and in the feed. */
export const URGENT_MAP_REPORT_KINDS: readonly MapReportKind[] = ["danger", "accident", "closed"];

export const mapReportSchema = geoPointSchema.extend({
  id: z.string().uuid(),
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  kind: mapReportKindSchema,
  note: z.string().nullable(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  confirmations: z.number().int().nonnegative(),
  lastConfirmedAt: z.coerce.date().nullable(),
});
export type MapReport = z.infer<typeof mapReportSchema>;

export const createMapReportInputSchema = geoPointSchema.extend({
  circleId: z.string().uuid(),
  kind: mapReportKindSchema,
  note: z.string().trim().max(140).optional(),
});
export type CreateMapReportInput = z.infer<typeof createMapReportInputSchema>;

export const listMapReportsQuerySchema = z.object({
  circleId: z.string().uuid(),
});

/** Pushed to the circle when a report is added, confirmed or removed, so clients refetch. */
export const mapReportsUpdatedSchema = z.object({
  circleId: z.string().uuid(),
  reportId: z.string().uuid(),
  change: z.enum(["created", "confirmed", "resolved"]),
  /** Who did it, and what, for the in-app banner. */
  userId: z.string().uuid(),
  displayName: z.string(),
  kind: mapReportKindSchema,
});
export type MapReportsUpdated = z.infer<typeof mapReportsUpdatedSchema>;
