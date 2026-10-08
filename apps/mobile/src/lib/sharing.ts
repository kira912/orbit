import { Share } from "react-native";
import { shareSessionSchema, type ShareSession, type StartShareSessionInput } from "@orbit/shared";
import { API_URL } from "../constants/config";
import { apiRequest } from "./api-client";
import { queryClient } from "./query-client";
import {
  isBackgroundLocationTrackingActive,
  resumeLocationTracking,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "../tasks/background-location-task";

/** Permission-denied errors from the background task, reworded for people. */
export async function startTracking(): Promise<void> {
  try {
    await startBackgroundLocationTracking();
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("Background")) {
      throw new Error("Autorise la localisation « Toujours » pour partager ton trajet écran éteint.");
    }
    if (message.includes("Foreground")) throw new Error("Autorise l'accès à ta position pour partager.");
    throw err;
  }
}

export async function startSharing(input: StartShareSessionInput): Promise<ShareSession> {
  await startTracking();
  const session = await apiRequest("/share-sessions", shareSessionSchema, { method: "POST", body: input });
  void queryClient.invalidateQueries({ queryKey: ["share-sessions"] });
  return session;
}

/**
 * Background tracking runs only while at least one of my sessions is active:
 * sessions end on their own (arrival, expiry, meetup closed) server-side, so
 * the phone follows whatever the server says instead of its own bookkeeping.
 */
export async function reconcileTracking(activeSessions: number): Promise<void> {
  if (activeSessions > 0) return resumeLocationTracking();
  if (await isBackgroundLocationTrackingActive()) await stopBackgroundLocationTracking();
}

export function publicShareUrl(token: string): string {
  return `${API_URL.replace(/\/$/, "")}/s/${token}`;
}

export async function sharePublicLink(token: string, destinationName?: string | null): Promise<void> {
  const url = publicShareUrl(token);
  await Share.share({
    message: destinationName
      ? `Suis mon trajet vers ${destinationName} en direct : ${url}`
      : `Suis ma position en direct : ${url}`,
    url,
  });
}
