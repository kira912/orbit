import { Injectable } from "@nestjs/common";
import { isWithinRadius, type GeoPoint } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface EvaluatedGeofenceEvent {
  id: string;
  placeId: string;
  placeName: string;
  circleId: string;
  userId: string;
  type: "enter" | "exit";
  occurredAt: Date;
}

@Injectable()
export class GeofencingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compares a fresh position against every place in the given circles and
   * returns the enter/exit transitions (persisted as they're found).
   *
   * Note: this does one "last event for this place" lookup per place, which
   * is fine for the handful of places a circle has at MVP scale. If that
   * ever becomes a bottleneck, replace it with a single grouped query
   * (e.g. `DISTINCT ON (placeId)` in Postgres).
   */
  async evaluate(
    userId: string,
    circleIds: string[],
    point: GeoPoint,
    occurredAt: Date,
  ): Promise<EvaluatedGeofenceEvent[]> {
    if (circleIds.length === 0) return [];

    const places = await this.prisma.place.findMany({
      where: { circleId: { in: circleIds } },
    });

    const events: EvaluatedGeofenceEvent[] = [];

    for (const place of places) {
      const inside = isWithinRadius(
        point,
        { latitude: place.latitude, longitude: place.longitude },
        place.radiusMeters,
      );

      const lastEvent = await this.prisma.geofenceEvent.findFirst({
        where: { placeId: place.id, userId },
        orderBy: { occurredAt: "desc" },
      });
      const wasInside = lastEvent?.type === "enter";

      if (inside === wasInside) continue;

      const type = inside ? "enter" : "exit";
      const created = await this.prisma.geofenceEvent.create({
        data: { placeId: place.id, userId, type, occurredAt },
      });

      events.push({
        id: created.id,
        placeId: place.id,
        placeName: place.name,
        circleId: place.circleId,
        userId,
        type,
        occurredAt,
      });
    }

    return events;
  }
}
