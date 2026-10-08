import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { placeSchema, type CreatePlaceInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const placesListSchema = z.array(placeSchema);
const deleteResultSchema = z.object({ success: z.boolean() });

export function usePlaces(circleId: string | null) {
  return useQuery({
    queryKey: ["places", circleId],
    queryFn: () => apiRequest("/places", placesListSchema, { query: { circleId: circleId as string } }),
    enabled: circleId !== null,
  });
}

export function useCreatePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlaceInput) =>
      apiRequest("/places", placeSchema, { method: "POST", body: input }),
    onSuccess: (place) => queryClient.invalidateQueries({ queryKey: ["places", place.circleId] }),
  });
}

export function useDeletePlace(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (placeId: string) =>
      apiRequest(`/places/${placeId}`, deleteResultSchema, { method: "DELETE", query: { circleId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["places", circleId] }),
  });
}
