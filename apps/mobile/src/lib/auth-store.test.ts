jest.mock("./api-client", () => ({
  apiRequest: jest.fn(),
  setSessionExpiredHandler: jest.fn(),
}));
jest.mock("./token-storage", () => ({
  tokenStorage: {
    getUser: jest.fn(),
    getAccessToken: jest.fn(),
    setSession: jest.fn(),
    clear: jest.fn(),
  },
}));

import { apiRequest } from "./api-client";
import { tokenStorage } from "./token-storage";
import { useAuthStore } from "./auth-store";

const mockedApiRequest = apiRequest as jest.Mock;
const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const USER = { id: "u1", email: "ada@example.com", displayName: "Ada", createdAt: new Date() };
const TOKENS = { accessToken: "access-1", refreshToken: "refresh-1" };

describe("useAuthStore", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({ status: "idle", user: null });
  });

  it("hydrates to authenticated when a session is stored", async () => {
    mockedTokenStorage.getUser.mockResolvedValue(USER);
    mockedTokenStorage.getAccessToken.mockResolvedValue(TOKENS.accessToken);

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("hydrates to unauthenticated when nothing is stored", async () => {
    mockedTokenStorage.getUser.mockResolvedValue(null);
    mockedTokenStorage.getAccessToken.mockResolvedValue(null);

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("login persists the session and flips to authenticated", async () => {
    mockedApiRequest.mockResolvedValue({ user: USER, tokens: TOKENS });

    await useAuthStore.getState().login({ email: USER.email, password: "correct-horse" });

    expect(mockedTokenStorage.setSession).toHaveBeenCalledWith(USER, TOKENS);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("login leaves the store untouched when the API call fails", async () => {
    mockedApiRequest.mockRejectedValue(new Error("invalid credentials"));

    await expect(
      useAuthStore.getState().login({ email: USER.email, password: "wrong" }),
    ).rejects.toThrow("invalid credentials");

    expect(useAuthStore.getState().status).toBe("idle");
    expect(mockedTokenStorage.setSession).not.toHaveBeenCalled();
  });

  it("logout clears storage and resets state", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER });

    await useAuthStore.getState().logout();

    expect(mockedTokenStorage.clear).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().user).toBeNull();
  });
});
