import { create } from "zustand";

interface MapFocusState {
  /** Member the map should fly to next time it renders; consumed (reset) by the map. */
  userId: string | null;
  focus: (userId: string) => void;
  consume: () => void;
}

/** Lets other screens (e.g. the members list) ask the map to center on someone. */
export const useMapFocusStore = create<MapFocusState>((set) => ({
  userId: null,
  focus: (userId) => set({ userId }),
  consume: () => set({ userId: null }),
}));
