import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import type { AcceptLocationRequestInput, CreateLocationRequestInput, LocationRequest } from "@orbit/shared";
import { acceptLocationRequestInputSchema } from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";
import { LOCATION_EVENTS, type LocationRequestUpdatedEvent } from "../locations/location-events";

/** A request the target hasn't answered in time simply lapses. */
const REQUEST_TTL_MS = 15 * 60_000;

const requestInclude = {
  fromUser: { select: { displayName: true } },
  toUser: { select: { displayName: true } },
  circle: { select: { name: true } },
} satisfies Prisma.LocationRequestInclude;

type RequestRow = Prisma.LocationRequestGetPayload<{ include: typeof requestInclude }>;

/**
 * "Tu es où ?": a member asks another to share. Nothing is revealed until the
 * target accepts, which starts an ordinary (temporary) share session.
 */
@Injectable()
export class LocationRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly sessions: ShareSessionsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(fromUserId: string, input: CreateLocationRequestInput): Promise<LocationRequest> {
    if (fromUserId === input.toUserId) throw new BadRequestException("Tu ne peux pas te le demander à toi-même");
    await this.circles.assertMembership(fromUserId, input.circleId);
    await this.circles.assertMembership(input.toUserId, input.circleId);

    const alreadySharing = await this.prisma.shareSession.findFirst({
      where: { userId: input.toUserId, circleId: input.circleId, status: "active" },
    });
    if (alreadySharing) throw new BadRequestException("Cette personne partage déjà sa position");

    // Asking twice doesn't nag twice: the pending request is returned as is.
    const pending = await this.prisma.locationRequest.findFirst({
      where: {
        fromUserId,
        toUserId: input.toUserId,
        circleId: input.circleId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      include: requestInclude,
    });
    if (pending) return this.toDto(pending);

    const created = await this.prisma.locationRequest.create({
      data: {
        circleId: input.circleId,
        fromUserId,
        toUserId: input.toUserId,
        expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
      },
      include: requestInclude,
    });
    return this.emit(created, "created");
  }

  /** Requests waiting for my answer. */
  async incoming(userId: string): Promise<LocationRequest[]> {
    const requests = await this.prisma.locationRequest.findMany({
      where: { toUserId: userId, status: "pending", expiresAt: { gt: new Date() } },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
    return requests.map((r) => this.toDto(r));
  }

  async accept(userId: string, id: string, rawInput: AcceptLocationRequestInput): Promise<LocationRequest> {
    const input = acceptLocationRequestInputSchema.parse(rawInput);
    const request = await this.answerable(userId, id);
    const session = await this.sessions.start(userId, {
      circleId: request.circleId,
      durationMinutes: input.durationMinutes,
    });
    const updated = await this.prisma.locationRequest.update({
      where: { id },
      data: { status: "accepted", respondedAt: new Date(), sessionId: session.id },
      include: requestInclude,
    });
    return this.emit(updated, "accepted");
  }

  async decline(userId: string, id: string): Promise<LocationRequest> {
    await this.answerable(userId, id);
    const updated = await this.prisma.locationRequest.update({
      where: { id },
      data: { status: "declined", respondedAt: new Date() },
      include: requestInclude,
    });
    return this.emit(updated, "declined");
  }

  /** Marks lapsed requests as expired (silently: no one needs a notification for that). */
  async expireDue(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.locationRequest.updateMany({
      where: { status: "pending", expiresAt: { lte: now } },
      data: { status: "expired" },
    });
    return count;
  }

  private async answerable(userId: string, id: string) {
    const request = await this.prisma.locationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Demande introuvable");
    if (request.toUserId !== userId) throw new ForbiddenException("Cette demande ne t'est pas adressée");
    if (request.status !== "pending" || request.expiresAt <= new Date()) {
      throw new BadRequestException("Cette demande a expiré");
    }
    return request;
  }

  private emit(row: RequestRow, change: LocationRequestUpdatedEvent["change"]): LocationRequest {
    const request = this.toDto(row);
    this.events.emit(LOCATION_EVENTS.LocationRequestUpdated, { request, change } satisfies LocationRequestUpdatedEvent);
    return request;
  }

  private toDto(row: RequestRow): LocationRequest {
    return {
      id: row.id,
      circleId: row.circleId,
      circleName: row.circle.name,
      fromUserId: row.fromUserId,
      fromName: row.fromUser.displayName,
      toUserId: row.toUserId,
      toName: row.toUser.displayName,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }
}
