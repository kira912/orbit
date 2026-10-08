type Listener = (position: GeolocationPosition) => void;
type ErrorListener = (error: GeolocationPositionError) => void;

const listeners = new Set<Listener>();
const errorListeners = new Set<ErrorListener>();
let watchId: number | null = null;
let last: GeolocationPosition | null = null;

/**
 * The page's single geolocation watch, shared by the map (blue dot, camera
 * follow) and location sharing; it runs while anyone listens. One watch
 * rather than several: browsers may hold back getCurrentPosition while a
 * watch is active, and each extra watch costs battery.
 */
export function subscribeToUserPosition(listener: Listener, onError?: ErrorListener): () => void {
  listeners.add(listener);
  if (onError) errorListeners.add(onError);
  if (last) listener(last);
  if (watchId == null && typeof navigator !== "undefined" && navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        last = position;
        for (const l of listeners) l(position);
      },
      (error) => {
        for (const l of errorListeners) l(error);
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
  }
  return () => {
    listeners.delete(listener);
    if (onError) errorListeners.delete(onError);
    if (listeners.size === 0 && watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      last = null;
    }
  };
}
