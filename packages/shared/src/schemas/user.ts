import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(60),
  pictureUrl: z.string().url().nullish(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** Sign in with Google: the ID token the Google SDK returned on the device. */
export const googleAuthInputSchema = z.object({
  idToken: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof googleAuthInputSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const refreshInputSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
