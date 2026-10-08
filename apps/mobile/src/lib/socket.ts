import { io, type Socket } from "socket.io-client";
import {
  WS_EVENTS,
  type ClientToServerEvents,
  type LocationPingInput,
  type ServerToClientEvents,
} from "@orbit/shared";
import { API_URL } from "../constants/config";
import { tokenStorage } from "./token-storage";
import { useLiveLocationsStore } from "./live-locations-store";
import { useEventsFeedStore } from "./events-feed-store";
import { useSessionEtaStore } from "./session-eta-store";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export async function connectRealtime(): Promise<void> {
  if (socket?.connected) return;

  const accessToken = await tokenStorage.getAccessToken();
  if (!accessToken) return;

  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ["websocket"],
  });

  socket.on(WS_EVENTS.FriendLocationUpdate, (payload) => {
    useLiveLocationsStore.getState().upsert(payload);
  });

  socket.on(WS_EVENTS.GeofenceEvent, (payload) => {
    useEventsFeedStore.getState().pushGeofenceEvent(payload);
  });

  socket.on(WS_EVENTS.SessionEtaUpdate, (payload) => {
    useSessionEtaStore.getState().setEta(payload.sessionId, {
      distanceMeters: payload.distanceMeters,
      etaSeconds: payload.etaSeconds,
    });
  });

  socket.on(WS_EVENTS.SessionEnded, (payload) => {
    useSessionEtaStore.getState().clear(payload.sessionId);
    useEventsFeedStore.getState().pushSessionEnded(payload.sessionId, payload.status);
  });
}

export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}

/** Fire-and-forget: the REST /locations/ping fallback covers delivery when the socket is down. */
export function sendLocationUpdate(input: LocationPingInput): void {
  socket?.emit(WS_EVENTS.LocationUpdate, input);
}

export function isRealtimeConnected(): boolean {
  return socket?.connected ?? false;
}
