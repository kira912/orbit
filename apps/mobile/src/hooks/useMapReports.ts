import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { mapReportSchema, type CreateMapReportInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";

const reportsSchema = z.array(mapReportSchema);

export const mapReportKeys = { circle: (circleId: string | null) => ["map-reports", circleId] as const };

/** Reports currently on the map of a circle; refreshed live over the socket. */
export function useMapReports(circleId: string | null) {
  return useQuery({
    queryKey: mapReportKeys.circle(circleId),
    queryFn: () => apiRequest("/map-reports", reportsSchema, { query: { circleId: circleId as string } }),
    enabled: circleId !== null,
    // Reports expire on their own: refetch now and then so faded ones leave the map.
    refetchInterval: 5 * 60_000,
  });
}

function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["map-reports"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  };
}

export function useCreateMapReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: CreateMapReportInput) =>
      apiRequest("/map-reports", mapReportSchema, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useAnswerMapReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, stillThere }: { id: string; stillThere: boolean }) =>
      apiRequest(`/map-reports/${id}/${stillThere ? "confirm" : "resolve"}`, mapReportSchema, { method: "POST" }),
    onSuccess: invalidate,
  });
}
