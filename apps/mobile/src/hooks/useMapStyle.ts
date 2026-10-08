import { useQuery } from "@tanstack/react-query";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { BASE_STYLE_URL, fetchPastelStyle } from "../lib/map-style";

/**
 * The themed basemap style; null while it loads. Falls back to the untouched
 * upstream style URL if the themed one can't be built, so the map always shows.
 */
export function useMapStyle(): StyleSpecification | string | null {
  const { data, isError } = useQuery({
    queryKey: ["map-style"],
    queryFn: ({ signal }) => fetchPastelStyle(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  if (isError) return BASE_STYLE_URL;
  return data ?? null;
}
