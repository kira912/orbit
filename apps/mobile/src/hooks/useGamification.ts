import { useQuery } from "@tanstack/react-query";
import { gamificationProfileSchema, type GamificationProfile } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

export function useGamificationProfile() {
  return useQuery<GamificationProfile>({
    queryKey: ["gamification", "me"],
    queryFn: () => apiRequest("/gamification/me", gamificationProfileSchema),
  });
}

export function useUserGamificationProfile(userId?: string | null) {
  return useQuery<GamificationProfile>({
    queryKey: ["gamification", "user", userId],
    queryFn: () => apiRequest(`/gamification/users/${userId}`, gamificationProfileSchema),
    enabled: Boolean(userId),
  });
}
