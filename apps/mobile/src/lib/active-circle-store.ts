import { create } from "zustand";

interface ActiveCircleState {
  circleId: string | null;
  setCircleId: (id: string | null) => void;
}

/** Which circle the Map/Places/Profile tabs currently focus on. Defaults to the first circle loaded. */
export const useActiveCircleStore = create<ActiveCircleState>((set) => ({
  circleId: null,
  setCircleId: (id) => set({ circleId: id }),
}));
