import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { circleShareSessionSchema, shareSessionSchema } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const sessionsListSchema = z.array(shareSessionSchema);
const circleSessionsSchema = z.array(circleShareSessionSchema);

export const shareSessionKeys = {
  mine: ["share-sessions"] as const,
  circle: (circleId: string | null) => ["share-sessions", "circle", circleId] as const,
};

/** My own active sessions (all circles). */
export function useActiveShareSessions() {
  return useQuery({
    queryKey: shareSessionKeys.mine,
    queryFn: () => apiRequest("/share-sessions", sessionsListSchema),
    refetchInterval: 30_000,
  });
}

/** Everyone sharing with the circle right now, me included. */
export function useCircleShareSessions(circleId: string | null) {
  return useQuery({
    queryKey: shareSessionKeys.circle(circleId),
    queryFn: () => apiRequest(`/share-sessions/circle/${circleId}`, circleSessionsSchema),
    enabled: circleId !== null,
    refetchInterval: 60_000,
  });
}

export function useStopShareSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/share-sessions/${sessionId}/stop`, shareSessionSchema, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shareSessionKeys.mine }),
  });
}

export function useEnablePublicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/share-sessions/${sessionId}/public-link`, shareSessionSchema, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shareSessionKeys.mine }),
  });
}

/** "Tout va bien": answers a "Rentre bien" alert. */
export function useMarkOk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/share-sessions/${sessionId}/ok`, shareSessionSchema, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-sessions"] }),
  });
}
