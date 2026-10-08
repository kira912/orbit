import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { z } from "zod";
import { apiRequest } from "./api-client";

type NotificationsModule = typeof import("expo-notifications");

const okSchema = z.object({ success: z.boolean() });

/**
 * Expo Go dropped remote notifications on Android in SDK 53: merely importing
 * expo-notifications there logs an error. The module is therefore loaded
 * lazily, and only in a development/production build (which this app needs
 * anyway for the map and background location).
 */
export const pushSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let cached: NotificationsModule | null | undefined;
function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!pushSupported) return (cached = null);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require("expo-notifications") as NotificationsModule;
  // While the app is open, the in-app toasts (fed by the socket) already show
  // the same events: only let the OS display pushes when we're in background.
  module.setNotificationHandler({
    handleNotification: async () => {
      const foreground = AppState.currentState === "active";
      return {
        shouldShowBanner: !foreground,
        shouldShowList: true,
        shouldPlaySound: !foreground,
        shouldSetBadge: false,
      };
    },
  });
  return (cached = module);
}

let registeredToken: string | null = null;

/**
 * Asks for permission and sends this device's Expo push token to the API.
 * Best effort: Expo Go, simulators, a denied permission or a missing EAS
 * project id just mean no push, the in-app feed keeps working.
 */
export async function registerForPushNotifications(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Orbit",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: "#6C5CE7",
      });
    }
    if (!Device.isDevice) return;

    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn("[orbit] no EAS projectId configured: push notifications disabled (see README)");
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiRequest("/users/me/push-tokens", okSchema, { method: "POST", body: { token } });
    registeredToken = token;
  } catch (err) {
    console.warn("[orbit] push registration failed", err);
  }
}

/** On logout: this device must stop receiving the previous account's alerts. */
export async function unregisterPushNotifications(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  try {
    await apiRequest(`/users/me/push-tokens/${encodeURIComponent(token)}`, okSchema, { method: "DELETE" });
  } catch {
    // Expired session or offline: the server drops dead tokens on its own later.
  }
}

/** null when push isn't available at all (Expo Go). */
export async function getNotificationPermission(): Promise<{ granted: boolean; canAskAgain: boolean } | null> {
  const Notifications = notifications();
  if (!Notifications) return null;
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted, canAskAgain };
}

/**
 * Calls `open` with the `url` of a tapped notification, including the one
 * that launched the app. Returns the unsubscribe function.
 */
export function onNotificationTap(open: (url: string) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => undefined;
  const handle = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string") open(url);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
