import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { URGENT_MAP_REPORT_KINDS } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  LOCATION_EVENTS,
  type CircleMemberJoinedEvent,
  type GeofenceEventOccurredEvent,
  type LocationRequestUpdatedEvent,
  type MapReportChangedEvent,
  type MeetupCreatedEvent,
  type SessionAlertEvent,
  type SessionEndedEvent,
  type SessionStartedEvent,
} from "../locations/location-events";
import { ExpoPushClient } from "./expo-push.client";

interface Notification {
  title: string;
  body: string;
  url: string;
}

/**
 * Turns domain events into push notifications for the rest of the circle,
 * so alerts reach people whose app is closed (the socket only reaches open
 * apps). The actor never gets notified about their own action.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushClient,
  ) {}

  async registerToken(userId: string, token: string): Promise<void> {
    // A device that changes account moves its token to the new user.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { token, userId },
      update: { userId },
    });
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
  }

  @OnEvent(LOCATION_EVENTS.GeofenceEvent, { async: true, suppressErrors: true })
  onGeofence(event: GeofenceEventOccurredEvent) {
    const arrived = event.type === "enter";
    return this.notifyCircle(event.circleId, event.userId, {
      title: arrived ? `${event.displayName} est arrivé·e` : `${event.displayName} est parti·e`,
      body: arrived ? `📍 ${event.placeName}` : `A quitté ${event.placeName}`,
      url: "/activity",
    });
  }

  @OnEvent(LOCATION_EVENTS.SessionStarted, { async: true, suppressErrors: true })
  onSessionStarted(event: SessionStartedEvent) {
    return this.notifyCircle(event.circleId, event.userId, {
      title: event.meetupId
        ? `${event.displayName} est en route`
        : `${event.displayName} partage sa position`,
      body: event.destinationName
        ? `Vers ${event.destinationName} · suis son trajet en direct`
        : "Suis son trajet en direct sur la carte",
      url: "/",
    });
  }

  @OnEvent(LOCATION_EVENTS.SessionEnded, { async: true, suppressErrors: true })
  onSessionEnded(event: SessionEndedEvent) {
    // Only arrival is news; expiry and manual stops would just be noise.
    if (event.status !== "arrived") return;
    return this.notifyCircle(event.circleId, event.userId, {
      title: `${event.displayName} est bien arrivé·e ✓`,
      body: event.destinationName ? `À ${event.destinationName}` : "Le partage s'est arrêté automatiquement",
      url: "/activity",
    });
  }

  @OnEvent(LOCATION_EVENTS.MeetupCreated, { async: true, suppressErrors: true })
  onMeetupCreated(event: MeetupCreatedEvent) {
    return this.notifyCircle(event.circleId, event.userId, {
      title: `${event.displayName} propose un rendez-vous`,
      body: `${event.name} · rejoins-le en un tap`,
      url: `/meetup/${event.meetupId}`,
    });
  }

  @OnEvent(LOCATION_EVENTS.CircleMemberJoined, { async: true, suppressErrors: true })
  onMemberJoined(event: CircleMemberJoinedEvent) {
    return this.notifyCircle(event.circleId, event.userId, {
      title: `${event.displayName} a rejoint ${event.circleName}`,
      body: "Dis-lui bonjour 👋",
      url: "/circle",
    });
  }

  @OnEvent(LOCATION_EVENTS.SessionAlert, { async: true, suppressErrors: true })
  async onSessionAlert(event: SessionAlertEvent) {
    const name = event.displayName;
    const where = event.destinationName ? ` à ${event.destinationName}` : "";
    if (event.kind === "ok") {
      return this.notifyCircle(event.circleId, event.userId, {
        title: `${name} indique que tout va bien ✓`,
        body: "Pas d'inquiétude, le trajet continue",
        url: "/",
      });
    }
    const alerts = {
      late: { title: `${name} n'est pas encore arrivé·e${where}`, body: "Son arrivée était prévue il y a plus de 15 min" },
      stalled: { title: `${name} ne bouge plus depuis 10 min`, body: "Toujours loin de sa destination" },
      silent: { title: `Plus de nouvelles de ${name}`, body: "Aucune position reçue depuis 10 min" },
    } as const;
    await this.notifyCircle(event.circleId, event.userId, { ...alerts[event.kind], url: "/" });
    // And to the person themselves, who can reassure everyone in one tap.
    await this.notifyUsers([event.userId], {
      title: "Tout va bien ?",
      body: "Ton cercle a été prévenu. Ouvre Orbit pour le rassurer.",
      url: "/",
    });
  }

  @OnEvent(LOCATION_EVENTS.LocationRequestUpdated, { async: true, suppressErrors: true })
  onLocationRequest({ request, change }: LocationRequestUpdatedEvent) {
    if (change === "created") {
      return this.notifyUsers([request.toUserId], {
        title: `${request.fromName} aimerait savoir où tu es`,
        body: "Partage ta position 15 min en un tap",
        url: "/",
      });
    }
    return this.notifyUsers([request.fromUserId], {
      title:
        change === "accepted"
          ? `${request.toName} partage sa position`
          : `${request.toName} ne peut pas partager pour le moment`,
      body: change === "accepted" ? "Regarde sur la carte" : "Réessaie un peu plus tard",
      url: "/",
    });
  }

  /** Only urgent reports are pushed; roadwork or traffic would just be noise. */
  @OnEvent(LOCATION_EVENTS.MapReportChanged, { async: true, suppressErrors: true })
  onMapReport({ report, change }: MapReportChangedEvent) {
    if (change !== "created" || !URGENT_MAP_REPORT_KINDS.includes(report.kind)) return;
    const labels = { danger: "un danger", accident: "un accident", closed: "une route barrée" } as Record<string, string>;
    return this.notifyCircle(report.circleId, report.userId, {
      title: `⚠️ ${report.displayName} signale ${labels[report.kind]}`,
      body: report.note ?? "Regarde où sur la carte",
      url: "/",
    });
  }

  private async notifyUsers(userIds: string[], notification: Notification) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    await this.send(tokens, notification, {});
  }

  private async notifyCircle(circleId: string, actorId: string, notification: Notification) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { not: actorId }, user: { memberships: { some: { circleId } } } },
      select: { token: true },
    });
    await this.send(tokens, notification, { circleId });
  }

  private async send(tokens: { token: string }[], notification: Notification, data: Record<string, unknown>) {
    if (tokens.length === 0) return;
    const dead = await this.push.send(
      tokens.map(({ token }) => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: { url: notification.url, ...data },
      })),
    );
    if (dead.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
  }
}
