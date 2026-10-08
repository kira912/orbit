import type { AuthTokens, User } from "@orbit/shared";

const ACCESS_TOKEN_KEY = "orbit.accessToken";
const REFRESH_TOKEN_KEY = "orbit.refreshToken";
const USER_KEY = "orbit.user";

/**
 * Web counterpart of token-storage.ts: browsers have no keychain, so the
 * session lives in localStorage (scoped to the PWA's origin).
 */
export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async getUser(): Promise<User | null> {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async setSession(user: User, tokens: AuthTokens): Promise<void> {
    await this.setTokens(tokens);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  async clear(): Promise<void> {
    for (const key of [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]) localStorage.removeItem(key);
  },
};
