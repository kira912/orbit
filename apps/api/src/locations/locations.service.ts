import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  FriendLocation,
  LatestLocationsQuery,
  LocationHistoryQuery,
  LocationPing,
  LocationPingInput,
} from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { GeofencingService } from "../geofencing/geofencing.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";
import { LOCATION_EVENTS, type SessionEndedEvent } from "./location-events";

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly geofencing: GeofencingService,
    private readonly sessions: ShareSessionsService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * The single entry point for a new position, whether it arrived over the
   * WebSocket gateway or the REST fallback endpoint. Persists it, then fans
   * out every downstream effect (circle broadcast, geofencing, share-session
   * ETA/arrival) via the internal event bus.
   */
  async recordPing(userId: string, input: LocationPingInput): Promise<LocationPing> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    });

    const ping = await this.prisma.locationPing.create({
      data: {
        userId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
        speed: input.speed ?? null,
        heading: input.heading ?? null,
        batteryLevel: input.batteryLevel ?? null,
        batteryCharging: input.batteryCharging ?? null,
        recordedAt: input.recordedAt,
      },
    });

    const circleIds = await this.circles.circleIdsForUser(userId);
    const point = { latitude: ping.latitude, longitude: ping.longitude };

    for (const circleId of circleIds) {
      this.events.emit(LOCATION_EVENTS.FriendLocationUpdated, {
        id: ping.id,
        userId,
        circleId,
        displayName: user.displayName,
        latitude: ping.latitude,
        longitude: ping.longitude,
        accuracy: ping.accuracy,
        speed: ping.speed,
        heading: ping.heading,
        batteryLevel: ping.batteryLevel,
        batteryCharging: ping.batteryCharging,
        recordedAt: ping.recordedAt,
      });
    }

    const geofenceEvents = await this.geofencing.evaluate(
      userId,
      circleIds,
      point,
      input.recordedAt,
    );
    for (const event of geofenceEvents) {
      this.events.emit(LOCATION_EVENTS.GeofenceEvent, {
        ...event,
        displayName: user.displayName,
      });
    }

    const sessionUpdates = await this.sessions.handleLocationUpdate(
      userId,
      point,
      input.speed,
      input.recordedAt,
    );
    for (const update of sessionUpdates) {
      if (update.kind === "eta") {
        this.events.emit(LOCATION_EVENTS.SessionEtaUpdate, {
          circleId: update.session.circleId,
          sessionId: update.session.id,
          distanceMeters: update.distanceMeters,
          etaSeconds: update.etaSeconds,
        });
      } else {
        this.events.emit(LOCATION_EVENTS.SessionEnded, {
          circleId: update.session.circleId,
          sessionId: update.session.id,
          userId,
          displayName: user.displayName,
          destinationName: update.session.destinationName,
          status: update.status,
        } satisfies SessionEndedEvent);
      }
    }

    return {
      id: ping.id,
      userId,
      latitude: ping.latitude,
      longitude: ping.longitude,
      accuracy: ping.accuracy,
      speed: ping.speed,
      heading: ping.heading,
      batteryLevel: ping.batteryLevel,
      batteryCharging: ping.batteryCharging,
      recordedAt: ping.recordedAt,
    };
  }

  /**
   * Last known position of every member of a circle, so clients can show
   * members who haven't moved since the app opened (the realtime feed only
   * carries new pings). Members who never shared a position are omitted.
   */
  async latest(requesterId: string, query: LatestLocationsQuery): Promise<FriendLocation[]> {
    await this.circles.assertMembership(requesterId, query.circleId);

    const members = await this.prisma.circleMember.findMany({
      where: { circleId: query.circleId },
      select: { userId: true, user: { select: { displayName: true } } },
    });
    const displayNames = new Map(members.map((m) => [m.userId, m.user.displayName]));

    const pings = await this.prisma.locationPing.findMany({
      where: { userId: { in: [...displayNames.keys()] } },
      orderBy: { recordedAt: "desc" },
      distinct: ["userId"], // first row per user in recordedAt desc order = latest
    });

    return pings.map((p) => ({
      id: p.id,
      userId: p.userId,
      circleId: query.circleId,
      displayName: displayNames.get(p.userId) ?? "",
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      speed: p.speed,
      heading: p.heading,
      batteryLevel: p.batteryLevel,
      batteryCharging: p.batteryCharging,
      recordedAt: p.recordedAt,
    }));
  }

  async history(requesterId: string, query: LocationHistoryQuery): Promise<LocationPing[]> {
    await this.circles.assertMembership(requesterId, query.circleId);
    // The requester must share a circle with the target user too, otherwise
    // membership in *some* circle would leak the history of unrelated users.
    await this.circles.assertMembership(query.userId, query.circleId);

    const pings = await this.prisma.locationPing.findMany({
      where: {
        userId: query.userId,
        recordedAt: { gte: query.from, lte: query.to },
      },
      orderBy: { recordedAt: "asc" },
    });

    return pings.map((p) => ({
      id: p.id,
      userId: p.userId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      speed: p.speed,
      heading: p.heading,
      batteryLevel: p.batteryLevel,
      batteryCharging: p.batteryCharging,
      recordedAt: p.recordedAt,
    }));
  }
}
