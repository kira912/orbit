import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { generateInviteCode } from "@orbit/shared";
import type { CircleWithMembers, CreateCircleInput } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_EVENTS, type CircleMemberJoinedEvent } from "../locations/location-events";

const INVITE_CODE_MAX_ATTEMPTS = 5;

@Injectable()
export class CirclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ownerId: string, input: CreateCircleInput): Promise<CircleWithMembers> {
    const inviteCode = await this.generateUniqueInviteCode();

    const circle = await this.prisma.circle.create({
      data: {
        name: input.name,
        ownerId,
        inviteCode,
        members: { create: { userId: ownerId } },
      },
      include: { members: { include: { user: true } } },
    });

    return this.toDto(circle);
  }

  async join(userId: string, inviteCode: string): Promise<CircleWithMembers> {
    const circle = await this.prisma.circle.findUnique({
      where: { inviteCode },
      include: { members: { include: { user: true } } },
    });
    if (!circle) {
      throw new NotFoundException("Invalid invite code");
    }

    const alreadyMember = circle.members.some((m) => m.userId === userId);
    if (!alreadyMember) {
      const membership = await this.prisma.circleMember.create({
        data: { circleId: circle.id, userId },
        include: { user: { select: { displayName: true } } },
      });
      this.events.emit(LOCATION_EVENTS.CircleMemberJoined, {
        circleId: circle.id,
        circleName: circle.name,
        userId,
        displayName: membership.user.displayName,
      } satisfies CircleMemberJoinedEvent);
      return this.join(userId, inviteCode);
    }

    return this.toDto(circle);
  }

  async listForUser(userId: string): Promise<CircleWithMembers[]> {
    const circles = await this.prisma.circle.findMany({
      where: { members: { some: { userId } } },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    });
    return circles.map((c) => this.toDto(c));
  }

  /** Throws if the user isn't a member; callers use this as an authorization check. */
  async assertMembership(userId: string, circleId: string): Promise<void> {
    const membership = await this.prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException("Not a member of this circle");
    }
  }

  async circleIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.circleMember.findMany({
      where: { userId },
      select: { circleId: true },
    });
    return memberships.map((m) => m.circleId);
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
      const code = generateInviteCode();
      const existing = await this.prisma.circle.findUnique({
        where: { inviteCode: code },
      });
      if (!existing) return code;
    }
    throw new Error("Could not generate a unique invite code");
  }

  private toDto(circle: {
    id: string;
    name: string;
    inviteCode: string;
    ownerId: string;
    createdAt: Date;
    members: { circleId: string; userId: string; joinedAt: Date; user: { displayName: string; email: string; pictureUrl: string | null } }[];
  }): CircleWithMembers {
    return {
      id: circle.id,
      name: circle.name,
      inviteCode: circle.inviteCode,
      ownerId: circle.ownerId,
      createdAt: circle.createdAt,
      members: circle.members.map((m) => ({
        circleId: m.circleId,
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        pictureUrl: m.user.pictureUrl,
        joinedAt: m.joinedAt,
      })),
    };
  }
}
