import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { locationRequestSchema, type CreateLocationRequestInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";
import { startTracking } from "../lib/sharing";

const requestsSchema = z.array(locationRequestSchema);

export const locationRequestKeys = { incoming: ["location-requests", "incoming"] as const };

/** "Tu es où ?" requests waiting for my answer. */
export function useIncomingLocationRequests(enabled = true) {
  return useQuery({
    queryKey: locationRequestKeys.incoming,
    queryFn: () => apiRequest("/location-requests/incoming", requestsSchema),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useAskLocation() {
  return useMutation({
    mutationFn: (input: CreateLocationRequestInput) =>
      apiRequest("/location-requests", locationRequestSchema, { method: "POST", body: input }),
  });
}

export function useAnswerLocationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept, durationMinutes }: { id: string; accept: boolean; durationMinutes?: number }) => {
      if (!accept) {
        return apiRequest(`/location-requests/${id}/decline`, locationRequestSchema, { method: "POST" });
      }
      // Sharing means the GPS: get the permission before telling anyone yes.
      await startTracking();
      return apiRequest(`/location-requests/${id}/accept`, locationRequestSchema, {
        method: "POST",
        body: { durationMinutes },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["location-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["share-sessions"] });
    },
  });
}
