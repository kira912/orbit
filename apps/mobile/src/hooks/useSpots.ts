import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  spotSchema,
  spotCommentSchema,
  type CreateSpotInput,
  type ListSpotsQuery,
  type Spot,
  type SpotComment,
} from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const spotsArraySchema = z.array(spotSchema);
const toggleLikeResponseSchema = z.object({
  liked: z.boolean(),
  likesCount: z.number(),
});
const toggleSaveResponseSchema = z.object({
  saved: z.boolean(),
});

export const spotKeys = {
  all: ["spots"] as const,
  list: (query?: ListSpotsQuery) => ["spots", "list", query] as const,
  detail: (id: string | null) => ["spots", "detail", id] as const,
};

export function useSpots(query?: ListSpotsQuery) {
  const queryRecord: Record<string, string> | undefined = query
    ? Object.fromEntries(
        Object.entries(query)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )
    : undefined;

  return useQuery({
    queryKey: spotKeys.list(query),
    queryFn: () =>
      apiRequest("/spots", spotsArraySchema, {
        query: queryRecord,
      }),
  });
}

export function useSpot(id: string | null) {
  return useQuery({
    queryKey: spotKeys.detail(id),
    queryFn: () => apiRequest(`/spots/${id}`, spotSchema),
    enabled: id !== null,
  });
}

function useInvalidateSpots() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: spotKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  };
}

export function useCreateSpot() {
  const invalidate = useInvalidateSpots();
  return useMutation({
    mutationFn: (input: CreateSpotInput) =>
      apiRequest("/spots", spotSchema, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useToggleLikeSpot() {
  const invalidate = useInvalidateSpots();
  return useMutation({
    mutationFn: (spotId: string) =>
      apiRequest(`/spots/${spotId}/like`, toggleLikeResponseSchema, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

export function useToggleSaveSpot() {
  const invalidate = useInvalidateSpots();
  return useMutation({
    mutationFn: (spotId: string) =>
      apiRequest(`/spots/${spotId}/save`, toggleSaveResponseSchema, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

export function useAddSpotComment() {
  const invalidate = useInvalidateSpots();
  return useMutation({
    mutationFn: ({ spotId, message }: { spotId: string; message: string }) =>
      apiRequest(`/spots/${spotId}/comments`, spotCommentSchema, {
        method: "POST",
        body: { message },
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteSpot() {
  const invalidate = useInvalidateSpots();
  return useMutation({
    mutationFn: (spotId: string) =>
      apiRequest(`/spots/${spotId}`, z.object({ success: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
}
