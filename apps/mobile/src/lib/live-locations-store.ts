import { create } from "zustand";
import type { FriendLocation } from "@orbit/shared";

interface LiveLocationsState {
  byUserId: Record<string, FriendLocation>;
  upsert: (location: FriendLocation) => void;
  clear: () => void;
}

/**
 * Latest known position per circle member: seeded from /locations/latest,
 * then kept fresh by the realtime socket. Older positions never overwrite
 * newer ones (a slow REST response can land after a socket update).
 */
export const useLiveLocationsStore = create<LiveLocationsState>((set) => ({
  byUserId: {},
  upsert: (location) =>
    set((state) => {
      const current = state.byUserId[location.userId];
      if (current && new Date(current.recordedAt) > new Date(location.recordedAt)) return state;
      return { byUserId: { ...state.byUserId, [location.userId]: location } };
    }),
  clear: () => set({ byUserId: {} }),
}));
