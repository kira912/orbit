import { Platform, TurboModuleRegistry, type TurboModule } from "react-native";
import Constants from "expo-constants";

/**
 * Host of the Metro dev server this bundle was loaded from. Expo CLI exposes
 * it as `hostUri`; a plain debug build pointed at the PC by hand (dev menu →
 * "Debug server host") doesn't, but the bundle's own URL still carries it.
 */
interface SourceCodeModule extends TurboModule {
  getConstants: () => { scriptURL?: string };
}

function devServerHost(): string | undefined {
  const fromExpo = Constants.expoConfig?.hostUri?.split(":")[0];
  if (fromExpo) return fromExpo;
  try {
    const sourceCode = TurboModuleRegistry.get<SourceCodeModule>("SourceCode");
    const scriptURL = sourceCode?.getConstants().scriptURL;
    return scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Derives the API's LAN address from the dev server's host so a physical
 * device on the same network can reach it with zero config.
 * Override with EXPO_PUBLIC_API_URL for a staging/production API.
 */
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  // PWA: the API is expected on the same host as the page.
  if (Platform.OS === "web") return `${window.location.protocol}//${window.location.hostname}:3333`;

  const host = devServerHost();
  if (host) return `http://${host}:3333`;

  return "http://localhost:3333";
}

export const API_URL = resolveApiUrl();

/**
 * Public address of the PWA, used in invite links and QR codes so that any
 * phone camera can open them. On web it's the page's own origin; native
 * builds without EXPO_PUBLIC_WEB_URL fall back to the app's orbit:// scheme.
 */
export const WEB_URL: string | null =
  process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ??
  (Platform.OS === "web" ? window.location.origin : null);
