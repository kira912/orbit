import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import { MAP_REPORT_TTL_MINUTES, type CreateMapReportInput, type MapReport } from "@orbit/shared";
import { CirclesService } from "../circles/circles.service";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_EVENTS, type MapReportChangedEvent } from "../locations/location-events";

/** Beyond this, a member is flooding the map: older reports are what they should clean up. */
const MAX_ACTIVE_REPORTS_PER_MEMBER = 20;
/** Resolved/expired reports are kept this long for the activity feed, then deleted. */
const RETENTION_MS = 7 * 86_400_000;

const reportInclude = { user: { select: { displayName: true } } } satisfies Prisma.MapReportInclude;
type ReportRow = Prisma.MapReportGetPayload<{ include: typeof reportInclude }>;

/**
 * "Signaler" on the map: circle-scoped reports that fade on their own
 * (per-kind TTL), stay alive while members confirm them, and can be removed
 * by any member once they're gone. Members of a circle trust each other, so
 * no voting threshold.
 */
@Injectable()
export class MapReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly events: EventEmitter2,
  ) {}

  async listActive(userId: string, circleId: string, now = new Date()): Promise<MapReport[]> {
    await this.circles.assertMembership(userId, circleId);
    const rows = await this.prisma.mapReport.findMany({
      where: { circleId, resolvedAt: null, expiresAt: { gt: now } },
      include: reportInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, input: CreateMapReportInput, now = new Date()): Promise<MapReport> {
    await this.circles.assertMembership(userId, input.circleId);
    const active = await this.prisma.mapReport.count({
      where: { circleId: input.circleId, userId, resolvedAt: null, expiresAt: { gt: now } },
    });
    if (active >= MAX_ACTIVE_REPORTS_PER_MEMBER) {
      throw new BadRequestException("Tu as déjà beaucoup de signalements actifs dans ce cercle");
    }

    const row = await this.prisma.mapReport.create({
      data: {
        circleId: input.circleId,
        userId,
        kind: input.kind,
        note: input.note || null,
        latitude: input.latitude,
        longitude: input.longitude,
        expiresAt: this.expiryFrom(input.kind, now),
      },
      include: reportInclude,
    });
    return this.emit(row, "created", userId, row.user.displayName);
  }

  /** "Toujours là": restarts the report's clock. */
  async confirm(userId: string, reportId: string, now = new Date()): Promise<MapReport> {
    const report = await this.activeReport(userId, reportId, now);
    const row = await this.prisma.mapReport.update({
      where: { id: report.id },
      data: {
        confirmations: { increment: 1 },
        lastConfirmedAt: now,
        expiresAt: this.expiryFrom(report.kind, now),
      },
      include: reportInclude,
    });
    return this.emit(row, "confirmed", userId, await this.nameOf(userId));
  }

  /** "Plus là": removes it from the map for everyone. */
  async resolve(userId: string, reportId: string, now = new Date()): Promise<MapReport> {
    const report = await this.activeReport(userId, reportId, now);
    const row = await this.prisma.mapReport.update({
      where: { id: report.id },
      data: { resolvedAt: now, resolvedById: userId },
      include: reportInclude,
    });
    return this.emit(row, "resolved", userId, await this.nameOf(userId));
  }

  /** Forgets reports that left the map more than a week ago. Run periodically. */
  async purgeOld(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_MS);
    const { count } = await this.prisma.mapReport.deleteMany({
      where: { OR: [{ resolvedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
    });
    return count;
  }

  private async activeReport(userId: string, reportId: string, now: Date) {
    const report = await this.prisma.mapReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Signalement introuvable");
    // Membership of the report's own circle, never a circle id sent by the client.
    await this.circles.assertMembership(userId, report.circleId);
    if (report.resolvedAt || report.expiresAt <= now) {
      throw new BadRequestException("Ce signalement n'est plus sur la carte");
    }
    return report;
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
    return user.displayName;
  }

  private expiryFrom(kind: MapReport["kind"], from: Date): Date {
    return new Date(from.getTime() + MAP_REPORT_TTL_MINUTES[kind] * 60_000);
  }

  private emit(row: ReportRow, change: MapReportChangedEvent["change"], actorId: string, actorName: string): MapReport {
    const report = this.toDto(row);
    this.events.emit(LOCATION_EVENTS.MapReportChanged, {
      report,
      change,
      actorId,
      actorName,
    } satisfies MapReportChangedEvent);
    return report;
  }

  private toDto(row: ReportRow): MapReport {
    return {
      id: row.id,
      circleId: row.circleId,
      userId: row.userId,
      displayName: row.user.displayName,
      kind: row.kind,
      note: row.note,
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      confirmations: row.confirmations,
      lastConfirmedAt: row.lastConfirmedAt,
    };
  }
}
