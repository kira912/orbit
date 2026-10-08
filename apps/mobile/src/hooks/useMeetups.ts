import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { meetupSchema, shareSessionSchema, type CreateMeetupInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";
import { startTracking } from "../lib/sharing";
import { shareSessionKeys } from "./useShareSessions";

const meetupsSchema = z.array(meetupSchema);

export const meetupKeys = {
  all: ["meetups"] as const,
  circle: (circleId: string | null) => ["meetups", "circle", circleId] as const,
  one: (id: string) => ["meetups", "one", id] as const,
};

export function useMeetups(circleId: string | null) {
  return useQuery({
    queryKey: meetupKeys.circle(circleId),
    queryFn: () => apiRequest("/meetups", meetupsSchema, { query: { circleId: circleId as string } }),
    enabled: circleId !== null,
    refetchInterval: 60_000,
  });
}

export function useMeetup(id: string) {
  return useQuery({
    queryKey: meetupKeys.one(id),
    queryFn: () => apiRequest(`/meetups/${id}`, meetupSchema),
  });
}

function useInvalidateMeetups() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: meetupKeys.all });
    void queryClient.invalidateQueries({ queryKey: shareSessionKeys.mine });
  };
}

export function useCreateMeetup() {
  const invalidate = useInvalidateMeetups();
  return useMutation({
    mutationFn: async (input: CreateMeetupInput) => {
      // Joining shares my way there: get the background permission before creating anything.
      if (input.join !== false) await startTracking();
      return apiRequest("/meetups", meetupSchema, { method: "POST", body: input });
    },
    onSuccess: invalidate,
  });
}

export function useJoinMeetup() {
  const invalidate = useInvalidateMeetups();
  return useMutation({
    mutationFn: async ({ id, publicLink }: { id: string; publicLink?: boolean }) => {
      await startTracking();
      return apiRequest(`/meetups/${id}/join`, shareSessionSchema, { method: "POST", body: { publicLink } });
    },
    onSuccess: invalidate,
  });
}

export function useEndMeetup() {
  const invalidate = useInvalidateMeetups();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/meetups/${id}/end`, meetupSchema, { method: "POST" }),
    onSuccess: invalidate,
  });
}
