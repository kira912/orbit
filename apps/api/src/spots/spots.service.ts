import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import type {
  AddSpotCommentInput,
  CreateSpotInput,
  ListSpotsQuery,
  Spot,
  SpotComment,
} from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_EVENTS, type SpotChangedEvent } from "../locations/location-events";

const spotInclude = {
  createdBy: { select: { displayName: true, pictureUrl: true } },
  circle: { select: { name: true } },
  _count: { select: { likes: true, comments: true } },
  likes: { select: { id: true } },
  savedBy: { select: { id: true } },
} satisfies Prisma.SpotInclude;

type SpotRow = Prisma.SpotGetPayload<{ include: typeof spotInclude }>;

@Injectable()
export class SpotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string, query: ListSpotsQuery = {}): Promise<Spot[]> {
    const userCircleIds = await this.circles.circleIdsForUser(userId);

    const where: Prisma.SpotWhereInput = {};

    if (query.circleId) {
      await this.circles.assertMembership(userId, query.circleId);
      where.circleId = query.circleId;
    } else if (query.visibility === "circle") {
      where.visibility = "circle";
      where.circleId = { in: userCircleIds };
    } else if (query.visibility === "public") {
      where.visibility = "public";
    } else {
      // By default: public spots OR circle spots for circles where user is a member
      where.OR = [
        { visibility: "public" },
        { visibility: "circle", circleId: { in: userCircleIds } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.mySpotsOnly) {
      where.createdById = userId;
    }

    if (query.savedOnly) {
      where.savedBy = { some: { userId } };
    }

    if (query.search) {
      const s = query.search.toLowerCase();
      where.AND = [
        {
          OR: [
            { title: { contains: s, mode: "insensitive" } },
            { description: { contains: s, mode: "insensitive" } },
            { tags: { has: s } },
            { address: { contains: s, mode: "insensitive" } },
          ],
        },
      ];
    }

    const rows = await this.prisma.spot.findMany({
      where,
      include: {
        ...spotInclude,
        likes: { where: { userId }, select: { id: true } },
        savedBy: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return rows.map((r) => this.toDto(r, userId));
  }

  async getById(userId: string, spotId: string): Promise<Spot> {
    const row = await this.prisma.spot.findUnique({
      where: { id: spotId },
      include: {
        ...spotInclude,
        likes: { where: { userId }, select: { id: true } },
        savedBy: { where: { userId }, select: { id: true } },
        comments: {
          include: { user: { select: { displayName: true, pictureUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!row) {
      throw new NotFoundException("Spot introuvable");
    }

    await this.assertAccess(userId, row);

    const comments: SpotComment[] = row.comments.map((c) => ({
      id: c.id,
      spotId: c.spotId,
      userId: c.userId,
      displayName: c.user.displayName,
      pictureUrl: c.user.pictureUrl,
      message: c.message,
      createdAt: c.createdAt,
    }));

    return {
      ...this.toDto(row, userId),
      comments,
    };
  }

  async create(userId: string, input: CreateSpotInput): Promise<Spot> {
    if (input.visibility === "circle") {
      if (!input.circleId) {
        throw new BadRequestException("Un cercle est requis pour un spot de cercle");
      }
      await this.circles.assertMembership(userId, input.circleId);
    }

    const row = await this.prisma.spot.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        visibility: input.visibility,
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address ?? null,
        tags: input.tags ?? [],
        createdById: userId,
        circleId: input.visibility === "circle" ? input.circleId : null,
      },
      include: {
        ...spotInclude,
        likes: { where: { userId }, select: { id: true } },
        savedBy: { where: { userId }, select: { id: true } },
      },
    });

    const spot = this.toDto(row, userId);
    this.events.emit(LOCATION_EVENTS.SpotChanged, {
      spotId: spot.id,
      circleId: spot.circleId,
      change: "created",
      userId,
      displayName: spot.creatorDisplayName,
      title: spot.title,
    } satisfies SpotChangedEvent);

    return spot;
  }

  async toggleLike(
    userId: string,
    spotId: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    const spot = await this.prisma.spot.findUnique({
      where: { id: spotId },
      include: { createdBy: { select: { displayName: true } } },
    });
    if (!spot) throw new NotFoundException("Spot introuvable");
    await this.assertAccess(userId, spot);

    const existing = await this.prisma.spotLike.findUnique({
      where: { spotId_userId: { spotId, userId } },
    });

    let liked = false;
    if (existing) {
      await this.prisma.spotLike.delete({
        where: { id: existing.id },
      });
      liked = false;
    } else {
      await this.prisma.spotLike.create({
        data: { spotId, userId },
      });
      liked = true;
    }

    const likesCount = await this.prisma.spotLike.count({ where: { spotId } });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    this.events.emit(LOCATION_EVENTS.SpotChanged, {
      spotId: spot.id,
      circleId: spot.circleId,
      change: "liked",
      userId,
      displayName: user?.displayName ?? "Un explorateur",
      title: spot.title,
    } satisfies SpotChangedEvent);

    return { liked, likesCount };
  }

  async toggleSave(userId: string, spotId: string): Promise<{ saved: boolean }> {
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) throw new NotFoundException("Spot introuvable");
    await this.assertAccess(userId, spot);

    const existing = await this.prisma.spotSaved.findUnique({
      where: { spotId_userId: { spotId, userId } },
    });

    if (existing) {
      await this.prisma.spotSaved.delete({ where: { id: existing.id } });
      return { saved: false };
    } else {
      await this.prisma.spotSaved.create({ data: { spotId, userId } });
      return { saved: true };
    }
  }

  async addComment(
    userId: string,
    spotId: string,
    input: AddSpotCommentInput,
  ): Promise<SpotComment> {
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) throw new NotFoundException("Spot introuvable");
    await this.assertAccess(userId, spot);

    const comment = await this.prisma.spotComment.create({
      data: {
        spotId,
        userId,
        message: input.message,
      },
      include: {
        user: { select: { displayName: true, pictureUrl: true } },
      },
    });

    this.events.emit(LOCATION_EVENTS.SpotChanged, {
      spotId: spot.id,
      circleId: spot.circleId,
      change: "commented",
      userId,
      displayName: comment.user.displayName,
      title: spot.title,
    } satisfies SpotChangedEvent);

    return {
      id: comment.id,
      spotId: comment.spotId,
      userId: comment.userId,
      displayName: comment.user.displayName,
      pictureUrl: comment.user.pictureUrl,
      message: comment.message,
      createdAt: comment.createdAt,
    };
  }

  async delete(userId: string, spotId: string): Promise<{ success: boolean }> {
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) throw new NotFoundException("Spot introuvable");

    if (spot.createdById !== userId) {
      throw new ForbiddenException("Seul le créateur peut supprimer ce spot");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    await this.prisma.spot.delete({ where: { id: spotId } });

    this.events.emit(LOCATION_EVENTS.SpotChanged, {
      spotId: spot.id,
      circleId: spot.circleId,
      change: "deleted",
      userId,
      displayName: user?.displayName ?? "Un explorateur",
      title: spot.title,
    } satisfies SpotChangedEvent);

    return { success: true };
  }

  private async assertAccess(
    userId: string,
    spot: { visibility: string; circleId: string | null; createdById: string },
  ) {
    if (spot.visibility === "public" || spot.createdById === userId) {
      return;
    }
    if (spot.circleId) {
      await this.circles.assertMembership(userId, spot.circleId);
      return;
    }
    throw new ForbiddenException("Accès non autorisé à ce spot");
  }

  private toDto(row: SpotRow, userId: string): Spot {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category as Spot["category"],
      visibility: row.visibility as Spot["visibility"],
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      tags: row.tags,
      createdById: row.createdById,
      creatorDisplayName: row.createdBy.displayName,
      creatorPictureUrl: row.createdBy.pictureUrl,
      circleId: row.circleId,
      circleName: row.circle?.name ?? null,
      likesCount: row._count.likes,
      commentsCount: row._count.comments,
      isLikedByMe: row.likes ? row.likes.length > 0 : false,
      isSavedByMe: row.savedBy ? row.savedBy.length > 0 : false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
