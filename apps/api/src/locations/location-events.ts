import type { FriendLocation, GeofenceEvent, LocationRequest, MapReport, SafetyAlertKind } from "@orbit/shared";

/**
 * Internal server-side pub/sub contract between the domain services
 * (producers) and RealtimeGateway / NotificationsService (consumers).
 * Deliberately separate from @orbit/shared's ws-events contract: these carry
 * routing metadata (circleId) that clients don't need on every event, and
 * keeping the two apart means the services never have to import Socket.io.
 */
export const LOCATION_EVENTS = {
  FriendLocationUpdated: "realtime.friend-location-updated",
  GeofenceEvent: "realtime.geofence-event",
  SessionStarted: "realtime.session-started",
  SessionEtaUpdate: "realtime.session-eta-update",
  SessionEnded: "realtime.session-ended",
  MeetupCreated: "realtime.meetup-created",
  MeetupUpdated: "realtime.meetup-updated",
  CircleMemberJoined: "realtime.circle-member-joined",
  SessionAlert: "realtime.session-alert",
  LocationRequestUpdated: "realtime.location-request-updated",
  MapReportChanged: "realtime.map-report-changed",
} as const;

export type FriendLocationUpdatedEvent = FriendLocation;
export type GeofenceEventOccurredEvent = GeofenceEvent;

export interface SessionStartedEvent {
  circleId: string;
  sessionId: string;
  userId: string;
  displayName: string;
  destinationName: string | null;
  meetupId: string | null;
}

export interface SessionEtaUpdateEvent {
  circleId: string;
  sessionId: string;
  distanceMeters: number;
  etaSeconds: number;
}

export interface SessionEndedEvent {
  circleId: string;
  sessionId: string;
  userId: string;
  displayName: string;
  destinationName: string | null;
  status: "arrived" | "expired" | "stopped";
}

export interface MeetupCreatedEvent {
  circleId: string;
  meetupId: string;
  userId: string;
  displayName: string;
  name: string;
}

export interface MeetupUpdatedEvent {
  circleId: string;
  meetupId: string;
}

export interface CircleMemberJoinedEvent {
  circleId: string;
  circleName: string;
  userId: string;
  displayName: string;
}

export interface SessionAlertEvent {
  circleId: string;
  sessionId: string;
  userId: string;
  displayName: string;
  destinationName: string | null;
  kind: SafetyAlertKind | "ok";
  /** For "late": when the person was expected. */
  expectedArrivalAt: Date | null;
}

export interface LocationRequestUpdatedEvent {
  request: LocationRequest;
  change: "created" | "accepted" | "declined";
}

export interface MapReportChangedEvent {
  report: MapReport;
  change: "created" | "confirmed" | "resolved";
  actorId: string;
  actorName: string;
}
