import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { activityItemSchema } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const activitySchema = z.array(activityItemSchema);

export const activityKeys = { circle: (circleId: string | null) => ["activity", circleId] as const };

export function useActivity(circleId: string | null) {
  return useQuery({
    queryKey: activityKeys.circle(circleId),
    queryFn: () => apiRequest(`/circles/${circleId}/activity`, activitySchema),
    enabled: circleId !== null,
  });
}
