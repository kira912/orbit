import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import { createMeetupInputSchema, type CreateMeetupInput, type JoinMeetupInput, type Meetup, type ShareSession } from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";
import {
  LOCATION_EVENTS,
  type MeetupCreatedEvent,
  type MeetupUpdatedEvent,
} from "../locations/location-events";

/** Arriving within this distance of the meeting point counts as "there". */
const MEETUP_ARRIVAL_RADIUS_METERS = 60;

const meetupInclude = {
  createdBy: { select: { displayName: true } },
  sessions: {
    include: { user: { select: { displayName: true } } },
    orderBy: { startedAt: "asc" },
  },
} satisfies Prisma.MeetupInclude;

type MeetupRow = Prisma.MeetupGetPayload<{ include: typeof meetupInclude }>;

@Injectable()
export class MeetupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly sessions: ShareSessionsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, rawInput: CreateMeetupInput): Promise<Meetup> {
    const input = createMeetupInputSchema.parse(rawInput);
    await this.circles.assertMembership(userId, input.circleId);

    const meetup = await this.prisma.meetup.create({
      data: {
        circleId: input.circleId,
        createdById: userId,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        endsAt: new Date(Date.now() + input.durationHours * 3_600_000),
      },
      include: { createdBy: { select: { displayName: true } } },
    });

    this.events.emit(LOCATION_EVENTS.MeetupCreated, {
      circleId: meetup.circleId,
      meetupId: meetup.id,
      userId,
      displayName: meetup.createdBy.displayName,
      name: meetup.name,
    } satisfies MeetupCreatedEvent);

    if (input.join) await this.join(userId, meetup.id, {});
    return this.get(userId, meetup.id);
  }

  async listActive(userId: string, circleId: string): Promise<Meetup[]> {
    await this.circles.assertMembership(userId, circleId);
    const meetups = await this.prisma.meetup.findMany({
      where: { circleId, status: "active", endsAt: { gt: new Date() } },
      include: meetupInclude,
      orderBy: { createdAt: "desc" },
    });
    return meetups.map((m) => this.toDto(m));
  }

  async get(userId: string, meetupId: string): Promise<Meetup> {
    const meetup = await this.prisma.meetup.findUnique({ where: { id: meetupId }, include: meetupInclude });
    if (!meetup) throw new NotFoundException("Meetup not found");
    await this.circles.assertMembership(userId, meetup.circleId);
    return this.toDto(meetup);
  }

  /** Starts sharing the user's way to the meeting point (idempotent while already en route). */
  async join(userId: string, meetupId: string, input: JoinMeetupInput): Promise<ShareSession> {
    const meetup = await this.prisma.meetup.findUnique({ where: { id: meetupId } });
    if (!meetup) throw new NotFoundException("Meetup not found");
    await this.circles.assertMembership(userId, meetup.circleId);
    if (meetup.status !== "active" || meetup.endsAt <= new Date()) {
      throw new BadRequestException("Ce rendez-vous est terminé");
    }

    const existing = await this.prisma.shareSession.findFirst({
      where: { meetupId, userId, status: "active" },
    });
    if (existing) return this.sessions.toDto(existing);

    const session = await this.sessions.start(
      userId,
      {
        circleId: meetup.circleId,
        destination: { latitude: meetup.latitude, longitude: meetup.longitude },
        destinationName: meetup.name,
        arrivalRadiusMeters: MEETUP_ARRIVAL_RADIUS_METERS,
        publicLink: input.publicLink,
      },
      { meetupId, expiresAt: meetup.endsAt },
    );

    this.emitUpdated(meetup.circleId, meetupId);
    return session;
  }

  /** Closes the meetup for everyone and stops the sessions still heading there. */
  async end(userId: string, meetupId: string): Promise<Meetup> {
    const meetup = await this.prisma.meetup.findUnique({ where: { id: meetupId } });
    if (!meetup) throw new NotFoundException("Meetup not found");
    if (meetup.createdById !== userId) {
      throw new ForbiddenException("Seul·e l'organisateur·rice peut terminer le rendez-vous");
    }
    await this.close([meetupId], "stopped");
    return this.get(userId, meetupId);
  }

  /** Ends meetups past their end time. Run periodically. */
  async expireDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.meetup.findMany({
      where: { status: "active", endsAt: { lte: now } },
      select: { id: true },
    });
    await this.close(
      due.map((m) => m.id),
      "expired",
      now,
    );
    return due.length;
  }

  private async close(meetupIds: string[], sessionStatus: "stopped" | "expired", now = new Date()) {
    if (meetupIds.length === 0) return;
    const meetups = await this.prisma.meetup.findMany({ where: { id: { in: meetupIds } } });
    await this.prisma.meetup.updateMany({
      where: { id: { in: meetupIds } },
      data: { status: "ended", endedAt: now },
    });
    const active = await this.prisma.shareSession.findMany({
      where: { meetupId: { in: meetupIds }, status: "active" },
      select: { id: true },
    });
    await this.sessions.end(
      active.map((s) => s.id),
      sessionStatus,
      now,
    );
    for (const m of meetups) this.emitUpdated(m.circleId, m.id);
  }

  private emitUpdated(circleId: string, meetupId: string) {
    this.events.emit(LOCATION_EVENTS.MeetupUpdated, { circleId, meetupId } satisfies MeetupUpdatedEvent);
  }

  private toDto(meetup: MeetupRow): Meetup {
    // One line per participant: their latest session for this meetup (a re-join after stopping wins).
    const latestByUser = new Map<string, MeetupRow["sessions"][number]>();
    for (const s of meetup.sessions) latestByUser.set(s.userId, s);

    return {
      id: meetup.id,
      circleId: meetup.circleId,
      createdById: meetup.createdById,
      createdByName: meetup.createdBy.displayName,
      name: meetup.name,
      latitude: meetup.latitude,
      longitude: meetup.longitude,
      status: meetup.status,
      createdAt: meetup.createdAt,
      endsAt: meetup.endsAt,
      participants: [...latestByUser.values()].map((s) => ({
        userId: s.userId,
        displayName: s.user.displayName,
        sessionId: s.id,
        status: s.status,
        endedAt: s.endedAt,
      })),
    };
  }
}
