import { z } from "zod";

export const registerPushTokenInputSchema = z.object({
  /** Expo push token, e.g. "ExponentPushToken[xxxx]". */
  token: z.string().min(1).max(200),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenInputSchema>;
