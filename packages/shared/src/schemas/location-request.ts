import { z } from "zod";

export const locationRequestStatusSchema = z.enum(["pending", "accepted", "declined", "expired"]);
export type LocationRequestStatus = z.infer<typeof locationRequestStatusSchema>;

/** "Tu es où ?": a member asks another one to share their position. */
export const locationRequestSchema = z.object({
  id: z.string().uuid(),
  circleId: z.string().uuid(),
  circleName: z.string(),
  fromUserId: z.string().uuid(),
  fromName: z.string(),
  toUserId: z.string().uuid(),
  toName: z.string(),
  status: locationRequestStatusSchema,
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});
export type LocationRequest = z.infer<typeof locationRequestSchema>;

export const createLocationRequestInputSchema = z.object({
  circleId: z.string().uuid(),
  toUserId: z.string().uuid(),
});
export type CreateLocationRequestInput = z.infer<typeof createLocationRequestInputSchema>;

export const acceptLocationRequestInputSchema = z.object({
  durationMinutes: z.number().positive().max(180).default(15),
});
export type AcceptLocationRequestInput = z.input<typeof acceptLocationRequestInputSchema>;
