import { create } from "zustand";
import type { GeofenceEvent, ShareSessionStatus } from "@orbit/shared";

export type FeedEvent =
  | { id: string; kind: "geofence"; event: GeofenceEvent }
  | { id: string; kind: "session-ended"; sessionId: string; status: ShareSessionStatus };

const MAX_FEED_LENGTH = 30;

interface EventsFeedState {
  feed: FeedEvent[];
  pushGeofenceEvent: (event: GeofenceEvent) => void;
  pushSessionEnded: (sessionId: string, status: ShareSessionStatus) => void;
}

/** Rolling in-app feed of geofence and share-session activity for the circles you're in. */
export const useEventsFeedStore = create<EventsFeedState>((set) => ({
  feed: [],
  pushGeofenceEvent: (event) =>
    set((state) => {
      const entry: FeedEvent = { id: event.id, kind: "geofence", event };
      return { feed: [entry, ...state.feed].slice(0, MAX_FEED_LENGTH) };
    }),
  pushSessionEnded: (sessionId, status) =>
    set((state) => {
      const entry: FeedEvent = {
        id: `${sessionId}-${status}-${Date.now()}`,
        kind: "session-ended",
        sessionId,
        status,
      };
      return { feed: [entry, ...state.feed].slice(0, MAX_FEED_LENGTH) };
    }),
}));
