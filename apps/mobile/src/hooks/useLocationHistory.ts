import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { locationPingSchema } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const historySchema = z.array(locationPingSchema);

export interface LocationHistoryParams {
  userId: string;
  circleId: string;
  from: Date;
  to: Date;
}

export function useLocationHistory(params: LocationHistoryParams | null) {
  return useQuery({
    queryKey: [
      "location-history",
      params?.userId,
      params?.circleId,
      params?.from.toISOString(),
      params?.to.toISOString(),
    ],
    queryFn: () =>
      apiRequest("/locations/history", historySchema, {
        query: {
          userId: params!.userId,
          circleId: params!.circleId,
          from: params!.from.toISOString(),
          to: params!.to.toISOString(),
        },
      }),
    enabled: params !== null,
  });
}
