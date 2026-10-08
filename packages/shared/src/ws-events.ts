import type { LocationPingInput, FriendLocation } from "./schemas/location";
import type { GeofenceEvent } from "./schemas/geofence-event";
import type { SessionEtaUpdate, SessionEnded } from "./schemas/share-session";

/**
 * Single source of truth for the realtime contract between apps/mobile and
 * apps/api, so client and server can never drift on event names or payloads.
 */
export const WS_EVENTS = {
  /** client -> server: report a new position. */
  LocationUpdate: "location:update",
  /** server -> client: a circle member moved. */
  FriendLocationUpdate: "location:friend-update",
  /** server -> client: a circle member entered/exited a place. */
  GeofenceEvent: "geofence:event",
  /** server -> client: ETA refresh for an active destination-share session. */
  SessionEtaUpdate: "session:eta-update",
  /** server -> client: a share session ended (arrived / expired / stopped). */
  SessionEnded: "session:ended",
} as const;

export interface ServerToClientEvents {
  [WS_EVENTS.FriendLocationUpdate]: (payload: FriendLocation) => void;
  [WS_EVENTS.GeofenceEvent]: (payload: GeofenceEvent) => void;
  [WS_EVENTS.SessionEtaUpdate]: (payload: SessionEtaUpdate) => void;
  [WS_EVENTS.SessionEnded]: (payload: SessionEnded) => void;
}

export interface ClientToServerEvents {
  [WS_EVENTS.LocationUpdate]: (payload: LocationPingInput) => void;
}
