import { Injectable } from "@nestjs/common";
import type { ActivityItem } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

const ACTIVITY_WINDOW_DAYS = 7;
const ACTIVITY_LIMIT = 60;

/**
 * A circle's recent timeline, rebuilt from the tables that already record
 * each fact (geofence events, sessions, meetups, memberships) instead of a
 * separate log that could drift from them.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async forCircle(circleId: string): Promise<ActivityItem[]> {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
    const user = { select: { displayName: true } };

    const [geofence, sessions, meetups, members] = await Promise.all([
      this.prisma.geofenceEvent.findMany({
        where: { place: { circleId }, occurredAt: { gte: since } },
        include: { user, place: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
      this.prisma.shareSession.findMany({
        where: { circleId, startedAt: { gte: since } },
        include: { user },
        orderBy: { startedAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
      this.prisma.meetup.findMany({
        where: { circleId, createdAt: { gte: since } },
        include: { createdBy: user },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
      this.prisma.circleMember.findMany({
        where: { circleId, joinedAt: { gte: since } },
        include: { user, circle: { select: { name: true } } },
        orderBy: { joinedAt: "desc" },
        take: ACTIVITY_LIMIT,
      }),
    ]);

    const items: ActivityItem[] = [
      ...geofence.map((e): ActivityItem => ({
        kind: "geofence",
        id: `geofence-${e.id}`,
        at: e.occurredAt,
        userId: e.userId,
        displayName: e.user.displayName,
        type: e.type,
        placeName: e.place.name,
      })),
      ...sessions.flatMap((s): ActivityItem[] => {
        const base = { userId: s.userId, displayName: s.user.displayName, destinationName: s.destinationName };
        const started: ActivityItem = { ...base, kind: "session-started", id: `start-${s.id}`, at: s.startedAt };
        const items: ActivityItem[] = [started];
        if (s.status === "arrived" && s.endedAt) {
          items.push({ ...base, kind: "session-arrived", id: `arrived-${s.id}`, at: s.endedAt });
        }
        const who = { userId: s.userId, displayName: s.user.displayName };
        for (const [alertKind, at] of [
          ["late", s.lateAlertAt],
          ["stalled", s.stalledAlertAt],
          ["silent", s.silentAlertAt],
        ] as const) {
          if (at) items.push({ ...base, kind: "safety-alert", id: `${alertKind}-${s.id}`, at, alertKind });
        }
        if (s.lastOkAt) items.push({ ...who, kind: "safety-ok", id: `ok-${s.id}`, at: s.lastOkAt });
        return items;
      }),
      ...meetups.map((m): ActivityItem => ({
        kind: "meetup-created",
        id: `meetup-${m.id}`,
        at: m.createdAt,
        userId: m.createdById,
        displayName: m.createdBy.displayName,
        meetupId: m.id,
        meetupName: m.name,
      })),
      ...members.map((m): ActivityItem => ({
        kind: "member-joined",
        id: `joined-${m.circleId}-${m.userId}`,
        at: m.joinedAt,
        userId: m.userId,
        displayName: m.user.displayName,
        circleName: m.circle.name,
      })),
    ];

    return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, ACTIVITY_LIMIT);
  }
}
