import type { z } from "zod";
import { authResponseSchema } from "@orbit/shared";
import { API_URL } from "../constants/config";
import { tokenStorage } from "./token-storage";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Set by auth-store so api-client can react to an unrecoverable auth failure
 * (refresh token itself rejected) without importing the store directly and
 * creating a cycle (auth-store already depends on api-client).
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<string> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    onSessionExpired?.();
    throw new ApiError(401, "No refresh token available");
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    onSessionExpired?.();
    throw new ApiError(res.status, "Session expired");
  }

  const parsed = authResponseSchema.parse(await res.json());
  await tokenStorage.setSession(parsed.user, parsed.tokens);
  return parsed.tokens.accessToken;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  query?: Record<string, string>;
  /** Skip attaching an Authorization header (login/register/refresh only). */
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(path, API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, skipAuth = false } = options;
  const url = buildUrl(path, query);

  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let accessToken = skipAuth ? null : await tokenStorage.getAccessToken();
  let res = await doFetch(accessToken);

  if (res.status === 401 && !skipAuth) {
    accessToken = await refreshAccessToken();
    res = await doFetch(accessToken);
  }

  const text = await res.text();
  const json = text.length > 0 ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : `Request to ${path} failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError(500, `Unexpected response shape from ${path}: ${result.error.message}`);
  }
  return result.data;
}
