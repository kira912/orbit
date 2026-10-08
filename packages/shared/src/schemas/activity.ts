import { z } from "zod";
import { mapReportKindSchema } from "./map-report";

const base = {
  id: z.string(),
  at: z.coerce.date(),
  userId: z.string().uuid(),
  displayName: z.string(),
};

/** One line of a circle's activity timeline. */
export const activityItemSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("geofence"), type: z.enum(["enter", "exit"]), placeName: z.string() }),
  z.object({ ...base, kind: z.literal("session-started"), destinationName: z.string().nullable() }),
  z.object({ ...base, kind: z.literal("session-arrived"), destinationName: z.string().nullable() }),
  z.object({ ...base, kind: z.literal("meetup-created"), meetupId: z.string().uuid(), meetupName: z.string() }),
  z.object({ ...base, kind: z.literal("member-joined"), circleName: z.string() }),
  z.object({
    ...base,
    kind: z.literal("safety-alert"),
    alertKind: z.enum(["late", "stalled", "silent"]),
    destinationName: z.string().nullable(),
  }),
  z.object({ ...base, kind: z.literal("safety-ok") }),
  z.object({
    ...base,
    kind: z.literal("map-report"),
    reportKind: mapReportKindSchema,
    note: z.string().nullable(),
  }),
]);
export type ActivityItem = z.infer<typeof activityItemSchema>;
