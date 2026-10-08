import Constants from "expo-constants";

/**
 * Derives the API's LAN address from the Metro dev server's host so a
 * physical device on the same network can reach it with zero config.
 * Override with EXPO_PUBLIC_API_URL for a staging/production API.
 */
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:3333`;

  return "http://localhost:3333";
}

export const API_URL = resolveApiUrl();
