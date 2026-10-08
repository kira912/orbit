import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { haversineDistanceMeters } from "@orbit/shared";
import { fetchRoute, type LatLng, type RouteProfile } from "../lib/routing";

/** Moves smaller than this don't recompute the route (GPS jitter, a member pacing around). */
const REROUTE_AFTER_METERS = 50;

/**
 * Route from the device's current position to `destination`, following both
 * ends as they move. Pass a null destination to stop (and stop watching GPS).
 * `targetKey` identifies what is being followed (e.g. the member id): while a
 * moving target is rerouted, the previous route stays on screen instead of flashing.
 */
export function useRoute(targetKey: string | null, destination: LatLng | null, profile: RouteProfile) {
  const active = destination != null;
  const origin = useStable(useMyPosition(active));
  const target = useStable(destination);

  const query = useQuery({
    queryKey: ["route", targetKey, profile, origin?.latitude, origin?.longitude, target?.latitude, target?.longitude],
    queryFn: ({ signal }) => fetchRoute(origin!, target!, profile, signal),
    enabled: origin != null && target != null,
    staleTime: Infinity,
    retry: 1,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === targetKey && previousQuery?.queryKey[2] === profile ? previous : undefined,
  });

  return { ...query, waitingForPosition: active && origin == null };
}

function useMyPosition(enabled: boolean): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: REROUTE_AFTER_METERS },
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
    )
      .then((sub) => (cancelled ? sub.remove() : (subscription = sub)))
      .catch(() => {
        // No permission / no fix: the caller shows that no route can be computed.
      });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
  return enabled ? position : null;
}

/** Same point until it moves more than REROUTE_AFTER_METERS, so the route isn't refetched on every ping. */
function useStable(point: LatLng | null): LatLng | null {
  const anchor = useRef<LatLng | null>(null);
  if (point == null) {
    anchor.current = null;
  } else if (anchor.current == null || haversineDistanceMeters(anchor.current, point) > REROUTE_AFTER_METERS) {
    anchor.current = { latitude: point.latitude, longitude: point.longitude };
  }
  return anchor.current;
}
