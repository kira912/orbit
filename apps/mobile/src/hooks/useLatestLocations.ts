import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { friendLocationSchema } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";
import { useLiveLocationsStore } from "../lib/live-locations-store";

const latestSchema = z.array(friendLocationSchema);
const REFRESH_MS = 60_000;

/**
 * Loads every circle member's last known position into the live store, so
 * members who haven't moved since the app opened still show up (the socket
 * only carries new pings). Refreshed periodically as a safety net for missed
 * realtime updates.
 */
export function useLatestLocations(circleId: string | null) {
  const query = useQuery({
    queryKey: ["locations-latest", circleId],
    queryFn: () =>
      apiRequest("/locations/latest", latestSchema, { query: { circleId: circleId as string } }),
    enabled: circleId !== null,
    refetchInterval: REFRESH_MS,
  });

  useEffect(() => {
    const upsert = useLiveLocationsStore.getState().upsert;
    query.data?.forEach(upsert);
  }, [query.data]);

  return query;
}
