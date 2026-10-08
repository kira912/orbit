import { z } from "zod";

jest.mock("./token-storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setSession: jest.fn(),
  },
}));

import { tokenStorage } from "./token-storage";
import { ApiError, apiRequest, setSessionExpiredHandler } from "./api-client";

const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

const itemSchema = z.object({ id: z.string() });

describe("apiRequest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("attaches the access token and parses a successful response", async () => {
    mockedTokenStorage.getAccessToken.mockResolvedValue("access-1");
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { id: "abc" }));

    const result = await apiRequest("/things/abc", itemSchema);

    expect(result).toEqual({ id: "abc" });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-1");
  });

  it("refreshes once on 401 and retries with the new access token", async () => {
    mockedTokenStorage.getAccessToken.mockResolvedValue("expired-token");
    mockedTokenStorage.getRefreshToken.mockResolvedValue("refresh-1");
    mockedTokenStorage.setSession.mockResolvedValue(undefined);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "a@b.com",
            displayName: "A",
            createdAt: new Date().toISOString(),
          },
          tokens: { accessToken: "fresh-token", refreshToken: "fresh-refresh" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { id: "abc" }));

    const result = await apiRequest("/things/abc", itemSchema);

    expect(result).toEqual({ id: "abc" });
    expect(mockedTokenStorage.setSession).toHaveBeenCalledTimes(1);
    const lastCallHeaders = (global.fetch as jest.Mock).mock.calls[2][1].headers;
    expect(lastCallHeaders.Authorization).toBe("Bearer fresh-token");
  });

  it("triggers the session-expired handler when the refresh token itself is rejected", async () => {
    mockedTokenStorage.getAccessToken.mockResolvedValue("expired-token");
    mockedTokenStorage.getRefreshToken.mockResolvedValue("stale-refresh");

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { message: "invalid refresh" }));

    const onSessionExpired = jest.fn();
    setSessionExpiredHandler(onSessionExpired);

    await expect(apiRequest("/things/abc", itemSchema)).rejects.toBeInstanceOf(ApiError);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("throws an ApiError carrying the server's message on failure", async () => {
    mockedTokenStorage.getAccessToken.mockResolvedValue("access-1");
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(400, { message: "Bad input" }));

    await expect(apiRequest("/things", itemSchema, { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      message: "Bad input",
    });
  });

  it("throws an ApiError when the response doesn't match the expected schema", async () => {
    mockedTokenStorage.getAccessToken.mockResolvedValue("access-1");
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { unexpected: true }));

    await expect(apiRequest("/things/abc", itemSchema)).rejects.toBeInstanceOf(ApiError);
  });
});
