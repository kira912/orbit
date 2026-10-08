import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  circleWithMembersSchema,
  type CreateCircleInput,
  type JoinCircleInput,
} from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const circlesListSchema = z.array(circleWithMembersSchema);

export function useCircles() {
  return useQuery({
    queryKey: ["circles"],
    queryFn: () => apiRequest("/circles", circlesListSchema),
  });
}

export function useCreateCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCircleInput) =>
      apiRequest("/circles", circleWithMembersSchema, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["circles"] }),
  });
}

export function useJoinCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinCircleInput) =>
      apiRequest("/circles/join", circleWithMembersSchema, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["circles"] }),
  });
}
