import { z } from "zod";

export const circleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  inviteCode: z.string(),
  ownerId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type Circle = z.infer<typeof circleSchema>;

export const circleMemberSchema = z.object({
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  joinedAt: z.coerce.date(),
});
export type CircleMember = z.infer<typeof circleMemberSchema>;

export const circleWithMembersSchema = circleSchema.extend({
  members: z.array(circleMemberSchema),
});
export type CircleWithMembers = z.infer<typeof circleWithMembersSchema>;

export const createCircleInputSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateCircleInput = z.infer<typeof createCircleInputSchema>;

export const joinCircleInputSchema = z.object({
  inviteCode: z.string().min(1),
});
export type JoinCircleInput = z.infer<typeof joinCircleInputSchema>;
