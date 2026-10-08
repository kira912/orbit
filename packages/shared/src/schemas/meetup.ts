import { z } from "zod";
import { geoPointSchema } from "./location";
import { shareSessionStatusSchema } from "./share-session";

export const meetupStatusSchema = z.enum(["active", "ended"]);
export type MeetupStatus = z.infer<typeof meetupStatusSchema>;

export const meetupParticipantSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  sessionId: z.string().uuid(),
  status: shareSessionStatusSchema,
  endedAt: z.coerce.date().nullable(),
});
export type MeetupParticipant = z.infer<typeof meetupParticipantSchema>;

/** A meeting point the circle converges to, each participant sharing their way there. */
export const meetupSchema = geoPointSchema.extend({
  id: z.string().uuid(),
  circleId: z.string().uuid(),
  createdById: z.string().uuid(),
  createdByName: z.string(),
  name: z.string().min(1).max(80),
  status: meetupStatusSchema,
  createdAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  participants: z.array(meetupParticipantSchema),
});
export type Meetup = z.infer<typeof meetupSchema>;

export const createMeetupInputSchema = geoPointSchema.extend({
  circleId: z.string().uuid(),
  name: z.string().min(1).max(80),
  /** How long the meetup (and the sessions joining it) stays open. */
  durationHours: z.number().positive().max(24).default(4),
  /** The creator starts sharing their way there right away. */
  join: z.boolean().default(true),
});
export type CreateMeetupInput = z.input<typeof createMeetupInputSchema>;

export const joinMeetupInputSchema = z.object({
  publicLink: z.boolean().optional(),
});
export type JoinMeetupInput = z.infer<typeof joinMeetupInputSchema>;

export const listMeetupsQuerySchema = z.object({
  circleId: z.string().uuid(),
});

/** Pushed to the circle when a meetup is created, joined or ended, so clients refetch. */
export const meetupUpdatedSchema = z.object({
  meetupId: z.string().uuid(),
  circleId: z.string().uuid(),
});
export type MeetupUpdated = z.infer<typeof meetupUpdatedSchema>;
