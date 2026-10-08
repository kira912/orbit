import type { LocationPingInput, FriendLocation } from "./schemas/location";
import type { GeofenceEvent } from "./schemas/geofence-event";
import type { SessionAlert, SessionEtaUpdate, SessionEnded, SessionStarted } from "./schemas/share-session";
import type { LocationRequest } from "./schemas/location-request";
import type { MeetupUpdated } from "./schemas/meetup";

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
  /** server -> client: a circle member started sharing. */
  SessionStarted: "session:started",
  /** server -> client: ETA refresh for an active destination-share session. */
  SessionEtaUpdate: "session:eta-update",
  /** server -> client: a share session ended (arrived / expired / stopped). */
  SessionEnded: "session:ended",
  /** server -> client: a meetup was created, joined or ended. */
  MeetupUpdated: "meetup:updated",
  /** server -> client: a "Rentre bien" alert was raised or cleared for a member's trip. */
  SessionAlert: "session:alert",
  /** server -> client (requester and target only): a "Tu es où ?" request changed. */
  LocationRequestUpdated: "location-request:updated",
  /** server -> client: someone joined one of your circles. */
  CircleUpdated: "circle:updated",
} as const;

export interface ServerToClientEvents {
  [WS_EVENTS.FriendLocationUpdate]: (payload: FriendLocation) => void;
  [WS_EVENTS.GeofenceEvent]: (payload: GeofenceEvent) => void;
  [WS_EVENTS.SessionStarted]: (payload: SessionStarted) => void;
  [WS_EVENTS.SessionEtaUpdate]: (payload: SessionEtaUpdate) => void;
  [WS_EVENTS.SessionEnded]: (payload: SessionEnded) => void;
  [WS_EVENTS.MeetupUpdated]: (payload: MeetupUpdated) => void;
  [WS_EVENTS.SessionAlert]: (payload: SessionAlert) => void;
  [WS_EVENTS.LocationRequestUpdated]: (payload: LocationRequest) => void;
  [WS_EVENTS.CircleUpdated]: (payload: { circleId: string }) => void;
}

export interface ClientToServerEvents {
  [WS_EVENTS.LocationUpdate]: (payload: LocationPingInput) => void;
}
