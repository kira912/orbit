import { create } from "zustand";

interface MapFocusState {
  /** Member the map should fly to next time it renders; consumed (reset) by the map. */
  userId: string | null;
  /** Also draw the route from the user to that member. */
  withRoute: boolean;
  focus: (userId: string, options?: { route?: boolean }) => void;
  consume: () => void;
}

/** Lets other screens (e.g. the members list) ask the map to center on someone. */
export const useMapFocusStore = create<MapFocusState>((set) => ({
  userId: null,
  withRoute: false,
  focus: (userId, options) => set({ userId, withRoute: options?.route ?? false }),
  consume: () => set({ userId: null, withRoute: false }),
}));
