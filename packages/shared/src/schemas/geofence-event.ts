import { z } from "zod";

export const geofenceEventTypeSchema = z.enum(["enter", "exit"]);
export type GeofenceEventType = z.infer<typeof geofenceEventTypeSchema>;

export const geofenceEventSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid(),
  placeName: z.string(),
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  type: geofenceEventTypeSchema,
  occurredAt: z.coerce.date(),
});
export type GeofenceEvent = z.infer<typeof geofenceEventSchema>;
