import { create } from "zustand";
import { authResponseSchema, type LoginInput, type RegisterInput, type User } from "@orbit/shared";
import { apiRequest, setSessionExpiredHandler } from "./api-client";
import { tokenStorage } from "./token-storage";

type AuthStatus = "idle" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  hydrate: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  user: null,

  hydrate: async () => {
    const [user, accessToken] = await Promise.all([
      tokenStorage.getUser(),
      tokenStorage.getAccessToken(),
    ]);
    set(
      user && accessToken
        ? { user, status: "authenticated" }
        : { user: null, status: "unauthenticated" },
    );
  },

  login: async (input) => {
    const response = await apiRequest("/auth/login", authResponseSchema, {
      method: "POST",
      body: input,
      skipAuth: true,
    });
    await tokenStorage.setSession(response.user, response.tokens);
    set({ user: response.user, status: "authenticated" });
  },

  register: async (input) => {
    const response = await apiRequest("/auth/register", authResponseSchema, {
      method: "POST",
      body: input,
      skipAuth: true,
    });
    await tokenStorage.setSession(response.user, response.tokens);
    set({ user: response.user, status: "authenticated" });
  },

  logout: async () => {
    await tokenStorage.clear();
    set({ user: null, status: "unauthenticated" });
  },
}));

setSessionExpiredHandler(() => {
  useAuthStore.getState().logout();
});
