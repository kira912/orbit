const KEY = "orbit.pendingInvite";

let memory: string | null = null;

/**
 * An invite opened while signed out, kept until the sign-in completes. Also
 * written to localStorage on web, where Google sign-in reloads the page.
 */
export function savePendingInvite(code: string): void {
  memory = code;
  try {
    globalThis.localStorage?.setItem(KEY, code);
  } catch {
    // Storage unavailable (private mode): the in-memory copy still covers email sign-in.
  }
}

/** The pending invite, at most once. */
export function takePendingInvite(): string | null {
  let code = memory;
  memory = null;
  try {
    code ??= globalThis.localStorage?.getItem(KEY) ?? null;
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // See savePendingInvite.
  }
  return code;
}
