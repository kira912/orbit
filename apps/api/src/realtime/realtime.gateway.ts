import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { locationPingInputSchema, WS_EVENTS } from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { LocationsService } from "../locations/locations.service";
import type {
  FriendLocationUpdatedEvent,
  GeofenceEventOccurredEvent,
  SessionEndedEvent,
  SessionEtaUpdateEvent,
} from "../locations/location-events";
import { LOCATION_EVENTS } from "../locations/location-events";
import type { JwtPayload } from "../auth/types";

function circleRoom(circleId: string): string {
  return `circle:${circleId}`;
}

@WebSocketGateway({ cors: { origin: "*" } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly circles: CirclesService,
    private readonly locations: LocationsService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      });
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = payload.sub;
    const circleIds = await this.circles.circleIdsForUser(payload.sub);
    await socket.join(circleIds.map(circleRoom));
  }

  @SubscribeMessage(WS_EVENTS.LocationUpdate)
  async handleLocationUpdate(socket: Socket, rawPayload: unknown): Promise<void> {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const result = locationPingInputSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logger.warn(`Rejected malformed location update from ${userId}`);
      return;
    }

    await this.locations.recordPing(userId, result.data);
  }

  @OnEvent(LOCATION_EVENTS.FriendLocationUpdated)
  handleFriendLocationUpdated(payload: FriendLocationUpdatedEvent): void {
    this.server.to(circleRoom(payload.circleId)).emit(WS_EVENTS.FriendLocationUpdate, payload);
  }

  @OnEvent(LOCATION_EVENTS.GeofenceEvent)
  handleGeofenceEvent(payload: GeofenceEventOccurredEvent): void {
    this.server.to(circleRoom(payload.circleId)).emit(WS_EVENTS.GeofenceEvent, payload);
  }

  @OnEvent(LOCATION_EVENTS.SessionEtaUpdate)
  handleSessionEtaUpdate(payload: SessionEtaUpdateEvent): void {
    const { circleId, ...rest } = payload;
    this.server.to(circleRoom(circleId)).emit(WS_EVENTS.SessionEtaUpdate, rest);
  }

  @OnEvent(LOCATION_EVENTS.SessionEnded)
  handleSessionEnded(payload: SessionEndedEvent): void {
    const { circleId, ...rest } = payload;
    this.server.to(circleRoom(circleId)).emit(WS_EVENTS.SessionEnded, rest);
  }
}
