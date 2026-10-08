import { useEffect, useState } from "react";
import * as Location from "expo-location";

export interface Address {
  /** "12 rue des Lilas, 75011 Paris" */
  full: string;
  /** Short name for a default label ("rue des Lilas", a POI name...). */
  short: string | null;
}

/** Reverse-geocodes with the OS geocoder (free, no API key); null while loading. */
export function useAddress(latitude: number | null, longitude: number | null): Address | null {
  const [address, setAddress] = useState<Address | null>(null);
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    // Keep showing the previous address while a moving member's new one loads.
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then(([place]) => {
        if (cancelled) return;
        if (!place) return setAddress({ full: "Adresse inconnue", short: null });
        const street = [place.streetNumber, place.street].filter(Boolean).join(" ");
        const city = [place.postalCode, place.city].filter(Boolean).join(" ");
        setAddress({
          full: [street || place.name, city].filter(Boolean).join(", ") || "Adresse inconnue",
          short: place.name && place.name !== place.streetNumber ? place.name : (place.street ?? null),
        });
      })
      .catch(() => !cancelled && setAddress({ full: "Adresse indisponible", short: null }));
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);
  return address;
}

/** A point passed as route params (long press on the map), or else the device's current position. */
export function usePointOrHere(lat?: string, lng?: string) {
  const fromParams = lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromParams) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Autorise la localisation pour utiliser ta position");
      const position = await Location.getCurrentPositionAsync({});
      if (!cancelled) setHere({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    })().catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
    // Params never change while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { point: fromParams ?? here, fromMap: fromParams != null, error };
}
