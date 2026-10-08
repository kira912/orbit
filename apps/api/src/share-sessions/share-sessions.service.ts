import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { estimateEtaSeconds, haversineDistanceMeters, type GeoPoint } from "@orbit/shared";
import type { ShareSession, StartShareSessionInput } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_ARRIVAL_RADIUS_METERS = 75;

export type ShareSessionUpdate =
  | { kind: "eta"; session: ShareSession; distanceMeters: number; etaSeconds: number }
  | { kind: "ended"; session: ShareSession; status: "arrived" | "expired" };

@Injectable()
export class ShareSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string, input: StartShareSessionInput): Promise<ShareSession> {
    const expiresAt = input.durationMinutes
      ? new Date(Date.now() + input.durationMinutes * 60_000)
      : null;

    const created = await this.prisma.shareSession.create({
      data: {
        userId,
        circleId: input.circleId,
        destinationLat: input.destination?.latitude ?? null,
        destinationLng: input.destination?.longitude ?? null,
        arrivalRadiusMeters: input.destination
          ? (input.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS)
          : null,
        expiresAt,
      },
    });

    return this.toDto(created);
  }

  async stop(userId: string, sessionId: string): Promise<ShareSession> {
    const session = await this.prisma.shareSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId) {
      throw new ForbiddenException("Not your session");
    }

    const updated = await this.prisma.shareSession.update({
      where: { id: sessionId },
      data: { status: "stopped", endedAt: new Date() },
    });

    return this.toDto(updated);
  }

  async listActiveForUser(userId: string): Promise<ShareSession[]> {
    const sessions = await this.prisma.shareSession.findMany({
      where: { userId, status: "active" },
      orderBy: { startedAt: "desc" },
    });
    return sessions.map((s) => this.toDto(s));
  }

  /**
   * Called on every incoming location ping. Advances (and, when relevant,
   * closes out) every active session the user has: arrival detection,
   * expiry, and a fresh ETA otherwise.
   */
  async handleLocationUpdate(
    userId: string,
    point: GeoPoint,
    speedMps: number | null | undefined,
    now: Date = new Date(),
  ): Promise<ShareSessionUpdate[]> {
    const sessions = await this.prisma.shareSession.findMany({
      where: { userId, status: "active" },
    });

    const updates: ShareSessionUpdate[] = [];

    for (const session of sessions) {
      if (session.expiresAt && session.expiresAt <= now) {
        const ended = await this.prisma.shareSession.update({
          where: { id: session.id },
          data: { status: "expired", endedAt: now },
        });
        updates.push({ kind: "ended", session: this.toDto(ended), status: "expired" });
        continue;
      }

      if (session.destinationLat == null || session.destinationLng == null) {
        continue;
      }

      const destination: GeoPoint = {
        latitude: session.destinationLat,
        longitude: session.destinationLng,
      };
      const distanceMeters = haversineDistanceMeters(point, destination);
      const radius = session.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS;

      if (distanceMeters <= radius) {
        const ended = await this.prisma.shareSession.update({
          where: { id: session.id },
          data: { status: "arrived", endedAt: now },
        });
        updates.push({ kind: "ended", session: this.toDto(ended), status: "arrived" });
        continue;
      }

      const etaSeconds = estimateEtaSeconds(distanceMeters, speedMps);
      updates.push({ kind: "eta", session: this.toDto(session), distanceMeters, etaSeconds });
    }

    return updates;
  }

  private toDto(session: {
    id: string;
    userId: string;
    circleId: string;
    destinationLat: number | null;
    destinationLng: number | null;
    arrivalRadiusMeters: number | null;
    expiresAt: Date | null;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
  }): ShareSession {
    return {
      id: session.id,
      userId: session.userId,
      circleId: session.circleId,
      destination:
        session.destinationLat != null && session.destinationLng != null
          ? { latitude: session.destinationLat, longitude: session.destinationLng }
          : null,
      arrivalRadiusMeters: session.arrivalRadiusMeters,
      expiresAt: session.expiresAt,
      status: session.status as ShareSession["status"],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }
}
