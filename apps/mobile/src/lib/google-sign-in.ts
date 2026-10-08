import Constants, { ExecutionEnvironment } from "expo-constants";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

/** OAuth "Web" client the ID token is requested for (the API checks it's the audience). */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/**
 * Google Sign-In is a native module: absent from Expo Go, so the button is
 * only offered in a development/production build with a client id set.
 */
export const googleSignInAvailable =
  WEB_CLIENT_ID.length > 0 && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let cached: GoogleSignInModule | null = null;
function google(): GoogleSignInModule {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("@react-native-google-signin/google-signin") as GoogleSignInModule;
    cached.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  }
  return cached;
}

/** Opens the system Google account picker; resolves to an ID token, or null if the user backed out. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = google();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return null;
    if (!response.data.idToken) throw new Error("Google n'a pas renvoyé de jeton d'identité");
    return response.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Les services Google Play sont indisponibles sur cet appareil");
      }
    }
    throw err;
  }
}

/** Web only (redirect flow, see google-sign-in.web.ts): the native picker resolves in place. */
export function hasPendingGoogleSignIn(): boolean {
  return false;
}

/** So the next "Continuer avec Google" shows the account picker again. */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleSignInAvailable) return;
  try {
    await google().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google: nothing to do.
  }
}
