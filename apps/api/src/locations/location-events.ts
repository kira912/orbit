import type { FriendLocation, GeofenceEvent } from "@orbit/shared";

/**
 * Internal server-side pub/sub contract between LocationsService (producer)
 * and RealtimeGateway (consumer). Deliberately separate from
 * @orbit/shared's ws-events contract: these carry routing metadata
 * (circleId) that clients don't need on every event, and keeping the two
 * apart means LocationsService never has to import Socket.io.
 */
export const LOCATION_EVENTS = {
  FriendLocationUpdated: "realtime.friend-location-updated",
  GeofenceEvent: "realtime.geofence-event",
  SessionEtaUpdate: "realtime.session-eta-update",
  SessionEnded: "realtime.session-ended",
} as const;

export type FriendLocationUpdatedEvent = FriendLocation;
export type GeofenceEventOccurredEvent = GeofenceEvent;

export interface SessionEtaUpdateEvent {
  circleId: string;
  sessionId: string;
  distanceMeters: number;
  etaSeconds: number;
}

export interface SessionEndedEvent {
  circleId: string;
  sessionId: string;
  status: "arrived" | "expired" | "stopped";
}
