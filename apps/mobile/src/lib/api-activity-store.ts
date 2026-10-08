import { create } from "zustand";

interface ApiActivityState {
  /** Start time of each API call in flight, by call id. */
  inFlight: Record<number, number>;
  begin: (id: number) => void;
  end: (id: number) => void;
}

/** Feeds the global "loading / server waking up" indicator (ApiActivityIndicator). */
export const useApiActivityStore = create<ApiActivityState>((set) => ({
  inFlight: {},
  begin: (id) => set((s) => ({ inFlight: { ...s.inFlight, [id]: Date.now() } })),
  end: (id) =>
    set((s) => {
      const { [id]: _done, ...rest } = s.inFlight;
      return { inFlight: rest };
    }),
}));

/**
 * When the longest-waiting call in flight started (null when idle): a burst
 * of quick calls never adds up to a long wait, only one slow call does.
 */
export function selectOldestCallStart(state: ApiActivityState): number | null {
  const starts = Object.values(state.inFlight);
  return starts.length > 0 ? Math.min(...starts) : null;
}

let nextId = 0;

/** Runs an API call while it counts as activity. */
export async function trackApiActivity<T>(call: () => Promise<T>): Promise<T> {
  const id = nextId++;
  const { begin, end } = useApiActivityStore.getState();
  begin(id);
  try {
    return await call();
  } finally {
    end(id);
  }
}
