import { z } from "zod";

export const badgeSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  unlockedAt: z.coerce.date().nullable(),
  progress: z.number(),
  maxProgress: z.number(),
});
export type Badge = z.infer<typeof badgeSchema>;

export const userStatsSchema = z.object({
  totalTrips: z.number(),
  safeTripsStreak: z.number(),
  meetupsJoined: z.number(),
  meetupPodiums: z.number(),
  placesVisited: z.number(),
  reactionsSent: z.number(),
});
export type UserStats = z.infer<typeof userStatsSchema>;

export const gamificationProfileSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  xp: z.number(),
  level: z.number(),
  levelTitle: z.string(),
  nextLevelXp: z.number(),
  currentLevelProgress: z.number(), // 0-100 percentage
  stats: userStatsSchema,
  badges: z.array(badgeSchema),
});
export type GamificationProfile = z.infer<typeof gamificationProfileSchema>;

export const sendReactionInputSchema = z.object({
  circleId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  emoji: z.string().min(1).max(8),
});
export type SendReactionInput = z.infer<typeof sendReactionInputSchema>;

export const tripReactionSchema = z.object({
  id: z.string().uuid(),
  circleId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  fromDisplayName: z.string(),
  targetUserId: z.string().uuid(),
  emoji: z.string(),
  timestamp: z.number(),
});
export type TripReaction = z.infer<typeof tripReactionSchema>;
