/** OAuth "Web" client the ID token is requested for (the API checks it's the audience). */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const REQUEST_KEY = "orbit.googleOAuthRequest";

/**
 * Web counterpart of google-sign-in.ts, using Google's OAuth redirect flow
 * rather than a popup: popups are unreliable in an installed iOS PWA. The
 * page's origin + "/" must be an authorized redirect URI of the Web client.
 */
export const googleSignInAvailable = WEB_CLIENT_ID.length > 0;

type RedirectResult = { idToken: string } | { error: string } | null;

/** Read once at startup, before the router rewrites the URL. */
let pending: RedirectResult = readRedirectResponse();

/** True when the page was just loaded back from Google: the sign-in should resume. */
export function hasPendingGoogleSignIn(): boolean {
  return pending != null;
}

/**
 * Resolves the ID token Google redirected back with if there is one;
 * otherwise leaves the app for Google's account picker (and never settles,
 * so the button stays busy while the page is replaced).
 */
export async function getGoogleIdToken(): Promise<string | null> {
  if (pending) {
    const result = pending;
    pending = null;
    if ("error" in result) {
      if (result.error === "access_denied") return null; // backed out of the picker
      throw new Error(describeError(result.error));
    }
    return result.idToken;
  }

  const request = { state: crypto.randomUUID(), nonce: crypto.randomUUID() };
  // localStorage, not sessionStorage: an installed iOS PWA may come back from
  // Google in a fresh browsing context, where sessionStorage is empty.
  localStorage.setItem(REQUEST_KEY, JSON.stringify(request));
  const params = new URLSearchParams({
    client_id: WEB_CLIENT_ID,
    redirect_uri: `${window.location.origin}/`,
    response_type: "id_token",
    scope: "openid email profile",
    prompt: "select_account",
    ...request,
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  return new Promise(() => undefined);
}

function readRedirectResponse(): RedirectResult {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("id_token") && !params.has("error")) return null;

  // Don't leave the token in the address bar or the history.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const raw = localStorage.getItem(REQUEST_KEY);
  localStorage.removeItem(REQUEST_KEY);
  const request = raw ? (JSON.parse(raw) as { state: string; nonce: string }) : null;

  // Only accept a response to the request this app made (no injected tokens).
  if (!request || params.get("state") !== request.state) return { error: "state_mismatch" };
  const error = params.get("error");
  if (error) return { error };
  const idToken = params.get("id_token")!;
  if (readNonce(idToken) !== request.nonce) return { error: "state_mismatch" };
  return { idToken };
}

/** The token's `nonce` claim; its signature is checked by the API. */
function readNonce(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as { nonce?: string }).nonce ?? null;
  } catch {
    return null;
  }
}

function describeError(error: string): string {
  if (error === "state_mismatch") return "La connexion Google a été interrompue, réessaie.";
  return `Connexion Google refusée (${error})`;
}

export async function signOutOfGoogle(): Promise<void> {
  // No Google session is kept on our side: "select_account" shows the picker each time.
}
