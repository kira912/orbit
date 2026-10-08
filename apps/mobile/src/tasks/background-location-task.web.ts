import { haversineDistanceMeters, type LocationPingInput } from "@orbit/shared";
import { z } from "zod";
import { apiRequest } from "../lib/api-client";
import { isRealtimeConnected, sendLocationUpdate } from "../lib/socket";
import { subscribeToUserPosition } from "../web/user-position";

/**
 * Web counterpart of background-location-task.ts. Browsers can't track
 * location in the background: positions are only sent while the page is
 * visible, and a screen wake lock keeps it visible while a share is active.
 * Same exports as the native module so callers don't branch on the platform.
 */
export const BACKGROUND_LOCATION_TASK = "orbit-background-location";

/** Same cadence as the native task: at most one ping per interval, unless moved further. */
const MIN_INTERVAL_MS = 15_000;
const MIN_DISTANCE_M = 30;
const FIRST_FIX_TIMEOUT_MS = 15_000;

const pingAckSchema = z.object({ id: z.string() });

let unsubscribe: (() => void) | null = null;
let lastSent: { at: number; latitude: number; longitude: number } | null = null;
let wakeLock: WakeLockSentinel | null = null;

export async function startBackgroundLocationTracking(): Promise<void> {
  if (!navigator.geolocation) throw new Error("Foreground location unavailable");
  if (unsubscribe) return;
  // Waits for the first fix, which proves the permission was granted. Without
  // a fix in time (indoors), sharing starts anyway and pings follow the fix.
  let fixed = false;
  await new Promise<void>((resolve, reject) => {
    const stop = subscribeToUserPosition(
      (position) => {
        fixed = true;
        resolve();
        void onPosition(position);
      },
      (err) => {
        // Once tracking, a lost signal (tunnel) is just a gap in the pings.
        if (fixed && err.code !== err.PERMISSION_DENIED) return;
        stop();
        if (unsubscribe === stop) unsubscribe = null;
        reject(new Error(err.code === err.PERMISSION_DENIED ? "Foreground location permission denied" : "Position indisponible"));
      },
    );
    unsubscribe = stop;
    setTimeout(resolve, FIRST_FIX_TIMEOUT_MS);
  });
  void acquireWakeLock(); // best effort: never hold up the share on it
  document.addEventListener("visibilitychange", onVisibilityChange);
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  lastSent = null;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  await wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  return unsubscribe != null;
}

/**
 * A reload loses the watch (the native task survives restarts): restart it
 * while a share is active, without prompting if the permission was revoked.
 */
export async function resumeLocationTracking(): Promise<void> {
  if (unsubscribe) return;
  try {
    const { state } = await navigator.permissions.query({ name: "geolocation" });
    if (state === "granted") await startBackgroundLocationTracking();
  } catch {
    // Permissions API missing or position unavailable: the user restarts sharing by hand.
  }
}

/** The OS drops the wake lock whenever the page is hidden: take it back on return. */
function onVisibilityChange() {
  if (document.visibilityState === "visible" && unsubscribe) void acquireWakeLock();
}

async function acquireWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator) || (wakeLock && !wakeLock.released)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    // Low battery mode or unsupported: sharing still works while the screen is on.
  }
}

async function onPosition(position: GeolocationPosition): Promise<void> {
  const { coords, timestamp } = position;
  if (lastSent) {
    const elapsed = timestamp - lastSent.at;
    const moved = haversineDistanceMeters(lastSent, coords);
    if (elapsed < MIN_INTERVAL_MS && moved < MIN_DISTANCE_M) return;
  }
  lastSent = { at: timestamp, latitude: coords.latitude, longitude: coords.longitude };

  const input: LocationPingInput = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    heading: coords.heading,
    ...(await readBattery()),
    recordedAt: new Date(timestamp),
  };

  if (isRealtimeConnected()) {
    sendLocationUpdate(input);
    return;
  }
  try {
    await apiRequest("/locations/ping", pingAckSchema, { method: "POST", body: input });
  } catch (err) {
    console.warn("[orbit] failed to send location ping", err);
  }
}

interface BatteryManager {
  level: number;
  charging: boolean;
}

/** Chromium only (Safari has no Battery API): null elsewhere. */
async function readBattery(): Promise<Pick<LocationPingInput, "batteryLevel" | "batteryCharging">> {
  try {
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery;
    if (!getBattery) return { batteryLevel: null, batteryCharging: null };
    const battery = await getBattery.call(navigator);
    return { batteryLevel: battery.level, batteryCharging: battery.charging };
  } catch {
    return { batteryLevel: null, batteryCharging: null };
  }
}
