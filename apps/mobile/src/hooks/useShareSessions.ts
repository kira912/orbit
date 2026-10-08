import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { shareSessionSchema, type StartShareSessionInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const sessionsListSchema = z.array(shareSessionSchema);

export function useActiveShareSessions() {
  return useQuery({
    queryKey: ["share-sessions"],
    queryFn: () => apiRequest("/share-sessions", sessionsListSchema),
    refetchInterval: 30_000,
  });
}

export function useStartShareSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartShareSessionInput) =>
      apiRequest("/share-sessions", shareSessionSchema, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-sessions"] }),
  });
}

export function useStopShareSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/share-sessions/${sessionId}/stop`, shareSessionSchema, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-sessions"] }),
  });
}
