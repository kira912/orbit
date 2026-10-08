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
import { useSessionEtaStore } from "./session-eta-store";
import { queryClient } from "./query-client";
import { useAuthStore } from "./auth-store";
import { useToastStore } from "../components/ui/Toaster";
import { colors } from "../theme";
import { REPORT_KINDS } from "./report-kinds";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const isMe = (userId: string) => useAuthStore.getState().user?.id === userId;
const toast = (...args: Parameters<ReturnType<typeof useToastStore.getState>["show"]>) =>
  useToastStore.getState().show(...args);
const refresh = (...keys: string[]) => {
  for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
};

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
    refresh("activity");
    if (isMe(payload.userId)) return;
    const arrived = payload.type === "enter";
    toast({
      title: `${payload.displayName} ${arrived ? "est arrivé·e" : "est parti·e"}`,
      body: arrived ? payload.placeName : `A quitté ${payload.placeName}`,
      icon: arrived ? "home" : "walk",
      color: arrived ? colors.success : colors.warning,
    });
  });

  socket.on(WS_EVENTS.SessionStarted, (payload) => {
    refresh("share-sessions", "activity", "meetups");
    if (isMe(payload.userId)) return;
    toast({
      title: `${payload.displayName} partage sa position`,
      body: "Suis son trajet en direct sur la carte",
      icon: "navigate",
    });
  });

  socket.on(WS_EVENTS.SessionEtaUpdate, (payload) => {
    useSessionEtaStore.getState().setEta(payload.sessionId, {
      distanceMeters: payload.distanceMeters,
      etaSeconds: payload.etaSeconds,
    });
  });

  socket.on(WS_EVENTS.SessionEnded, (payload) => {
    useSessionEtaStore.getState().clear(payload.sessionId);
    refresh("share-sessions", "activity", "meetups");
    if (payload.status !== "arrived") return;
    toast(
      isMe(payload.userId)
        ? { title: "Tu es arrivé·e 🎉", body: "Le partage s'est arrêté automatiquement", icon: "flag", color: colors.success }
        : { title: `${payload.displayName} est bien arrivé·e`, icon: "checkmark-circle", color: colors.success },
    );
  });

  socket.on(WS_EVENTS.SessionAlert, (payload) => {
    refresh("share-sessions", "activity");
    if (isMe(payload.userId)) return; // my own card shows the alert and the "tout va bien" button
    const where = payload.destinationName ? ` à ${payload.destinationName}` : "";
    const alerts = {
      late: { title: `${payload.displayName} n'est pas encore arrivé·e${where}`, icon: "time" as const },
      stalled: { title: `${payload.displayName} ne bouge plus depuis 10 min`, icon: "pause-circle" as const },
      silent: { title: `Plus de nouvelles de ${payload.displayName}`, icon: "cloud-offline" as const },
    };
    toast(
      payload.kind === "ok"
        ? { title: `${payload.displayName} indique que tout va bien`, icon: "checkmark-circle", color: colors.success }
        : { ...alerts[payload.kind], body: "Rentre bien · alerte", color: colors.danger },
    );
  });

  socket.on(WS_EVENTS.LocationRequestUpdated, (request) => {
    refresh("location-requests");
    // The target gets the prompt sheet (IncomingRequestPrompt); the requester gets the answer.
    if (!isMe(request.fromUserId) || request.status === "pending") return;
    if (request.status === "accepted") {
      refresh("share-sessions");
      toast({ title: `${request.toName} partage sa position`, body: "Regarde sur la carte", icon: "navigate", color: colors.success });
    } else if (request.status === "declined") {
      toast({ title: `${request.toName} ne peut pas partager pour le moment`, icon: "time", color: colors.muted });
    }
  });

  socket.on(WS_EVENTS.MapReportsUpdated, (payload) => {
    refresh("map-reports", "activity");
    if (payload.change !== "created" || isMe(payload.userId)) return;
    const meta = REPORT_KINDS[payload.kind];
    toast({ title: `${payload.displayName} signale ${meta.phrase}`, body: "Regarde sur la carte", icon: meta.icon, color: meta.color });
  });

  socket.on(WS_EVENTS.MeetupUpdated, () => refresh("meetups", "activity"));
  socket.on(WS_EVENTS.CircleUpdated, () => refresh("circles", "activity"));
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
