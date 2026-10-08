import { randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { ShareSession as ShareSessionRow } from "@prisma/client";
import { estimateEtaSeconds, haversineDistanceMeters, type GeoPoint } from "@orbit/shared";
import type {
  CircleShareSession,
  PublicShareSession,
  SafetyAlertKind,
  ShareSession,
  StartShareSessionInput,
} from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  LOCATION_EVENTS,
  type SessionAlertEvent,
  type SessionEndedEvent,
  type SessionStartedEvent,
} from "../locations/location-events";

const DEFAULT_ARRIVAL_RADIUS_METERS = 75;

/** "Rentre bien" thresholds. */
export const SAFETY = {
  /** Late: still not there this long after the expected arrival. */
  lateGraceMs: 15 * 60_000,
  /** Silent: no position received for this long. */
  silentAfterMs: 10 * 60_000,
  /** Stalled: no movement beyond this radius for stalledAfterMs... */
  stalledAfterMs: 10 * 60_000,
  stalledRadiusMeters: 60,
  /** ...while still at least this far from the destination. */
  stalledMinDistanceMeters: 250,
  /** "Tout va bien" pushes the expected arrival back by this much. */
  okExtensionMs: 15 * 60_000,
};

export type ShareSessionUpdate =
  | { kind: "eta"; session: ShareSession; distanceMeters: number; etaSeconds: number }
  | { kind: "ended"; session: ShareSession; status: "arrived" | "expired" };

/** Links tied to a meetup: the meetup's end bounds the session's. */
export interface StartOptions {
  meetupId?: string;
  expiresAt?: Date;
}

/** 18 random bytes = 24 url-safe chars: unguessable, short enough to share. */
export function generatePublicToken(): string {
  return randomBytes(18).toString("base64url");
}

@Injectable()
export class ShareSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async start(
    userId: string,
    input: StartShareSessionInput,
    options: StartOptions = {},
  ): Promise<ShareSession> {
    const expiresAt =
      options.expiresAt ??
      (input.durationMinutes ? new Date(Date.now() + input.durationMinutes * 60_000) : null);

    const created = await this.prisma.shareSession.create({
      data: {
        userId,
        circleId: input.circleId,
        destinationLat: input.destination?.latitude ?? null,
        destinationLng: input.destination?.longitude ?? null,
        destinationName: input.destination ? (input.destinationName ?? null) : null,
        arrivalRadiusMeters: input.destination
          ? (input.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS)
          : null,
        expiresAt,
        publicToken: input.publicLink ? generatePublicToken() : null,
        meetupId: options.meetupId ?? null,
        safetyAlerts: input.safetyAlerts ?? false,
      },
      include: { user: { select: { displayName: true } } },
    });

    this.events.emit(LOCATION_EVENTS.SessionStarted, {
      circleId: created.circleId,
      sessionId: created.id,
      userId,
      displayName: created.user.displayName,
      destinationName: created.destinationName,
      meetupId: created.meetupId,
    } satisfies SessionStartedEvent);

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
    if (session.status !== "active") return this.toDto(session);

    const [updated] = await this.end([session.id], "stopped");
    return updated;
  }

  /** Creates (or returns) the public link of one of the user's active sessions. */
  async enablePublicLink(userId: string, sessionId: string): Promise<ShareSession> {
    const session = await this.prisma.shareSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId) throw new ForbiddenException("Not your session");
    if (session.publicToken) return this.toDto(session);

    const updated = await this.prisma.shareSession.update({
      where: { id: sessionId },
      data: { publicToken: generatePublicToken() },
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

  /** Everyone currently sharing with the circle (callers check membership). */
  async listActiveForCircle(circleId: string): Promise<CircleShareSession[]> {
    const sessions = await this.prisma.shareSession.findMany({
      where: { circleId, status: "active" },
      orderBy: { startedAt: "desc" },
      include: { user: { select: { displayName: true } } },
    });
    return sessions.map(({ user, ...s }) => {
      const { publicToken: _private, ...dto } = this.toDto(s);
      return { ...dto, displayName: user.displayName };
    });
  }

  /**
   * The read-only view behind a public link. Only positions recorded during
   * the session are visible, and none at all once it has ended: the link
   * stops leaking anything the moment sharing stops.
   */
  async getPublic(token: string): Promise<PublicShareSession> {
    const session = await this.prisma.shareSession.findUnique({
      where: { publicToken: token },
      include: { user: { select: { displayName: true } } },
    });
    if (!session) throw new NotFoundException("Unknown link");

    const destination =
      session.destinationLat != null && session.destinationLng != null
        ? { latitude: session.destinationLat, longitude: session.destinationLng }
        : null;

    const active = session.status === "active" && (!session.expiresAt || session.expiresAt > new Date());
    const ping = active
      ? await this.prisma.locationPing.findFirst({
          // Server receive time, not the phone clock: a skewed phone must not hide (or leak) pings.
          where: { userId: session.userId, createdAt: { gte: session.startedAt } },
          orderBy: { recordedAt: "desc" },
        })
      : null;

    const distanceMeters = ping && destination ? haversineDistanceMeters(ping, destination) : null;
    return {
      displayName: session.user.displayName,
      status: active ? "active" : session.status === "active" ? "expired" : session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      destination,
      destinationName: session.destinationName,
      position: ping
        ? {
            latitude: ping.latitude,
            longitude: ping.longitude,
            accuracy: ping.accuracy,
            recordedAt: ping.recordedAt,
            batteryLevel: ping.batteryLevel,
          }
        : null,
      distanceMeters,
      etaSeconds: distanceMeters != null ? estimateEtaSeconds(distanceMeters, ping?.speed) : null,
    };
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
      // The first ETA of a "Rentre bien" trip sets when the person is expected.
      if (session.safetyAlerts && !session.expectedArrivalAt) {
        session.expectedArrivalAt = new Date(now.getTime() + etaSeconds * 1000);
        await this.prisma.shareSession.update({
          where: { id: session.id },
          data: { expectedArrivalAt: session.expectedArrivalAt },
        });
      }
      updates.push({ kind: "eta", session: this.toDto(session), distanceMeters, etaSeconds });
    }

    return updates;
  }

  /**
   * "Rentre bien": raises at most one alert of each kind per trip (until the
   * sharer says all is well) when a watched trip looks wrong. Run every minute.
   */
  async checkSafety(now: Date = new Date()): Promise<number> {
    const sessions = await this.prisma.shareSession.findMany({
      where: { status: "active", safetyAlerts: true },
      include: { user: { select: { displayName: true } } },
    });

    let raised = 0;
    for (const session of sessions) {
      const kind = await this.detectSafetyIssue(session, now);
      if (!kind) continue;

      const field = `${kind}AlertAt` as const;
      await this.prisma.shareSession.update({ where: { id: session.id }, data: { [field]: now } });
      raised++;
      this.events.emit(LOCATION_EVENTS.SessionAlert, {
        circleId: session.circleId,
        sessionId: session.id,
        userId: session.userId,
        displayName: session.user.displayName,
        destinationName: session.destinationName,
        kind,
        expectedArrivalAt: session.expectedArrivalAt,
      } satisfies SessionAlertEvent);
    }
    return raised;
  }

  private async detectSafetyIssue(session: ShareSessionRow, now: Date): Promise<SafetyAlertKind | null> {
    // An alert is "pending" until the sharer answers with "tout va bien".
    const pending = (at: Date | null) => at != null && (!session.lastOkAt || at > session.lastOkAt);
    const since = (ms: number) => new Date(now.getTime() - ms);
    // Grace period after the start, or after the last "tout va bien".
    const watchedSince = session.lastOkAt && session.lastOkAt > session.startedAt ? session.lastOkAt : session.startedAt;

    const lastPing = await this.prisma.locationPing.findFirst({
      where: { userId: session.userId, createdAt: { gte: session.startedAt } },
      orderBy: { createdAt: "desc" },
    });

    if (!pending(session.silentAlertAt) && watchedSince < since(SAFETY.silentAfterMs)) {
      if (!lastPing || lastPing.createdAt < since(SAFETY.silentAfterMs)) return "silent";
    }

    if (session.destinationLat == null || session.destinationLng == null || !lastPing) return null;
    const destination = { latitude: session.destinationLat, longitude: session.destinationLng };

    if (
      !pending(session.lateAlertAt) &&
      session.expectedArrivalAt &&
      now.getTime() > session.expectedArrivalAt.getTime() + SAFETY.lateGraceMs
    ) {
      return "late";
    }

    if (!pending(session.stalledAlertAt) && watchedSince < since(SAFETY.stalledAfterMs)) {
      const recent = await this.prisma.locationPing.findMany({
        where: { userId: session.userId, createdAt: { gte: since(SAFETY.stalledAfterMs) } },
        orderBy: { createdAt: "asc" },
      });
      // Pings must cover the whole window, otherwise "not moving" is just "few pings".
      const coversWindow =
        recent.length >= 2 && recent[0].createdAt.getTime() <= now.getTime() - SAFETY.stalledAfterMs * 0.7;
      const stuck = recent.every((p) => haversineDistanceMeters(p, lastPing) <= SAFETY.stalledRadiusMeters);
      const farFromDestination = haversineDistanceMeters(lastPing, destination) > SAFETY.stalledMinDistanceMeters;
      if (coversWindow && stuck && farFromDestination) return "stalled";
    }

    return null;
  }

  /** "Tout va bien": clears pending alerts and gives the trip more time. */
  async markOk(userId: string, sessionId: string, now: Date = new Date()): Promise<ShareSession> {
    const session = await this.prisma.shareSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { displayName: true } } },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId) throw new ForbiddenException("Not your session");

    const hadAlert = this.currentAlert(session) != null;
    const base = session.expectedArrivalAt && session.expectedArrivalAt > now ? session.expectedArrivalAt : now;
    const updated = await this.prisma.shareSession.update({
      where: { id: sessionId },
      data: {
        lastOkAt: now,
        expectedArrivalAt: session.expectedArrivalAt ? new Date(base.getTime() + SAFETY.okExtensionMs) : null,
      },
    });

    // Only worth telling the circle if they had been worried.
    if (hadAlert) {
      this.events.emit(LOCATION_EVENTS.SessionAlert, {
        circleId: session.circleId,
        sessionId: session.id,
        userId,
        displayName: session.user.displayName,
        destinationName: session.destinationName,
        kind: "ok",
        expectedArrivalAt: updated.expectedArrivalAt,
      } satisfies SessionAlertEvent);
    }
    return this.toDto(updated);
  }

  /** The most recent alert not yet answered by "tout va bien". */
  private currentAlert(session: ShareSessionRow): SafetyAlertKind | null {
    const alerts: [SafetyAlertKind, Date | null][] = [
      ["late", session.lateAlertAt],
      ["stalled", session.stalledAlertAt],
      ["silent", session.silentAlertAt],
    ];
    let current: [SafetyAlertKind, Date] | null = null;
    for (const [kind, at] of alerts) {
      if (!at || (session.lastOkAt && at <= session.lastOkAt)) continue;
      if (!current || at > current[1]) current = [kind, at];
    }
    return current?.[0] ?? null;
  }

  /**
   * Expires sessions whose deadline passed while the phone was silent (no
   * ping means handleLocationUpdate never ran for them). Run periodically.
   */
  async expireDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.shareSession.findMany({
      where: { status: "active", expiresAt: { lte: now } },
      select: { id: true },
    });
    if (due.length === 0) return 0;
    await this.end(
      due.map((s) => s.id),
      "expired",
      now,
    );
    return due.length;
  }

  /** Ends active sessions (e.g. when their meetup is closed) and notifies the circles. */
  async end(
    sessionIds: string[],
    status: "stopped" | "expired",
    now: Date = new Date(),
  ): Promise<ShareSession[]> {
    if (sessionIds.length === 0) return [];
    await this.prisma.shareSession.updateMany({
      where: { id: { in: sessionIds }, status: "active" },
      data: { status, endedAt: now },
    });
    const ended = await this.prisma.shareSession.findMany({
      where: { id: { in: sessionIds } },
      include: { user: { select: { displayName: true } } },
    });
    for (const session of ended) {
      this.events.emit(LOCATION_EVENTS.SessionEnded, {
        circleId: session.circleId,
        sessionId: session.id,
        userId: session.userId,
        displayName: session.user.displayName,
        destinationName: session.destinationName,
        status,
      } satisfies SessionEndedEvent);
    }
    return ended.map(({ user: _user, ...s }) => this.toDto(s));
  }

  toDto(session: ShareSessionRow): ShareSession {
    return {
      id: session.id,
      userId: session.userId,
      circleId: session.circleId,
      destination:
        session.destinationLat != null && session.destinationLng != null
          ? { latitude: session.destinationLat, longitude: session.destinationLng }
          : null,
      destinationName: session.destinationName,
      arrivalRadiusMeters: session.arrivalRadiusMeters,
      expiresAt: session.expiresAt,
      status: session.status as ShareSession["status"],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      publicToken: session.publicToken,
      meetupId: session.meetupId,
      safetyAlerts: session.safetyAlerts,
      expectedArrivalAt: session.expectedArrivalAt,
      alert: this.currentAlert(session),
    };
  }
}
