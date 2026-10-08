import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { z } from "zod";
import type { LocationPingInput } from "@orbit/shared";
import { apiRequest } from "../lib/api-client";
import { isRealtimeConnected, sendLocationUpdate } from "../lib/socket";

export const BACKGROUND_LOCATION_TASK = "orbit-background-location";

const pingAckSchema = z.object({ id: z.string() });

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[orbit] background location task error", error.message);
    return;
  }

  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const input: LocationPingInput = {
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: latest.coords.accuracy,
    speed: latest.coords.speed,
    heading: latest.coords.heading,
    ...(await readBattery()),
    recordedAt: new Date(latest.timestamp),
  };

  // Prefer the live socket (lower latency for friends watching the map);
  // fall back to REST when the app has no open connection (e.g. deep background).
  if (isRealtimeConnected()) {
    sendLocationUpdate(input);
    return;
  }

  try {
    await apiRequest("/locations/ping", pingAckSchema, { method: "POST", body: input });
  } catch (err) {
    console.warn("[orbit] failed to send background location ping", err);
  }
});

/** Best effort: a missing battery reading must never block a location ping. */
async function readBattery(): Promise<Pick<LocationPingInput, "batteryLevel" | "batteryCharging">> {
  try {
    const { batteryLevel, batteryState } = await Battery.getPowerStateAsync();
    return {
      batteryLevel: batteryLevel >= 0 ? batteryLevel : null, // -1 = unknown
      batteryCharging:
        batteryState === Battery.BatteryState.UNKNOWN
          ? null
          : batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL,
    };
  } catch {
    return { batteryLevel: null, batteryCharging: null };
  }
}

export async function startBackgroundLocationTracking(): Promise<void> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    throw new Error("Foreground location permission denied");
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    throw new Error("Background location permission denied");
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 30,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Orbit partage ta position",
      notificationBody: "Ton cercle peut voir où tu es tant que le partage est actif.",
    },
  });
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
