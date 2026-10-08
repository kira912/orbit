import { create } from "zustand";

interface SessionEta {
  distanceMeters: number;
  etaSeconds: number;
}

interface SessionEtaState {
  bySessionId: Record<string, SessionEta>;
  setEta: (sessionId: string, eta: SessionEta) => void;
  clear: (sessionId: string) => void;
}

/** Live ETA for the share sessions you're a passenger/watcher of, updated over the socket. */
export const useSessionEtaStore = create<SessionEtaState>((set) => ({
  bySessionId: {},
  setEta: (sessionId, eta) =>
    set((state) => ({ bySessionId: { ...state.bySessionId, [sessionId]: eta } })),
  clear: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.bySessionId;
      return { bySessionId: rest };
    }),
}));
