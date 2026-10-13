import { Injectable, NotFoundException } from "@nestjs/common";
import type { Badge, GamificationProfile, UserStats } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

interface LevelThreshold {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
}

const LEVELS: LevelThreshold[] = [
  { level: 1, title: "Explorateur Débutant", minXp: 0, maxXp: 100 },
  { level: 2, title: "Voyageur Régulier", minXp: 100, maxXp: 250 },
  { level: 3, title: "Guide de Cercle", minXp: 250, maxXp: 500 },
  { level: 4, title: "Maître des Trajets", minXp: 500, maxXp: 1000 },
  { level: 5, title: "Légende d'Orbite", minXp: 1000, maxXp: 2500 },
];

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<GamificationProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });
    if (!user) throw new NotFoundException("Utilisateur non trouvé");

    // Fetch user share sessions
    const sessions = await this.prisma.shareSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });

    const totalTrips = sessions.length;

    // Calculate safe streak: consecutive sessions with status 'arrived' from recent to oldest
    let safeTripsStreak = 0;
    for (const session of sessions) {
      if (session.status === "arrived") {
        safeTripsStreak++;
      } else if (session.status === "stopped" || session.status === "expired") {
        break;
      }
    }

    // Meetups joined
    const meetupSessions = sessions.filter((s) => s.meetupId != null);
    const distinctMeetupIds = [...new Set(meetupSessions.map((s) => s.meetupId!))];
    const meetupsJoined = distinctMeetupIds.length;

    // Meetup podiums (1st place arrivals)
    let meetupPodiums = 0;
    if (distinctMeetupIds.length > 0) {
      const meetupsWithSessions = await this.prisma.meetup.findMany({
        where: { id: { in: distinctMeetupIds } },
        include: {
          sessions: {
            where: { status: "arrived" },
            orderBy: { endedAt: "asc" },
          },
        },
      });

      for (const m of meetupsWithSessions) {
        if (m.sessions.length > 0 && m.sessions[0].userId === userId) {
          meetupPodiums++;
        }
      }
    }

    // Places visited
    const geofenceEvents = await this.prisma.geofenceEvent.findMany({
      where: { userId, type: "enter" },
      select: { placeId: true },
    });
    const placesVisited = new Set(geofenceEvents.map((g) => g.placeId)).size;

    // Night trip arrived
    const hasNightTrip = sessions.some((s) => {
      if (s.status !== "arrived" || !s.endedAt) return false;
      const hour = new Date(s.endedAt).getHours();
      return hour >= 22 || hour <= 5;
    });

    const stats: UserStats = {
      totalTrips,
      safeTripsStreak,
      meetupsJoined,
      meetupPodiums,
      placesVisited,
      reactionsSent: 0,
    };

    // XP calculation
    const xp =
      totalTrips * 20 +
      safeTripsStreak * 15 +
      meetupsJoined * 35 +
      meetupPodiums * 50 +
      placesVisited * 15;

    // Level calculation
    let currentLevel = LEVELS[0];
    for (const lvl of LEVELS) {
      if (xp >= lvl.minXp) {
        currentLevel = lvl;
      }
    }

    const nextLevel = LEVELS.find((l) => l.level === currentLevel.level + 1) ?? {
      level: currentLevel.level + 1,
      title: "Légende Suprême",
      minXp: currentLevel.maxXp,
      maxXp: currentLevel.maxXp * 2,
    };

    const xpInLevel = xp - currentLevel.minXp;
    const levelSpan = currentLevel.maxXp - currentLevel.minXp;
    const currentLevelProgress = Math.min(
      100,
      Math.max(0, Math.round((xpInLevel / levelSpan) * 100)),
    );

    // Badges computation
    const badges: Badge[] = [
      {
        id: "badge-first-trip",
        code: "first_trip",
        title: "Premier Décollage",
        description: "Partager son 1er trajet dans un cercle",
        icon: "rocket-outline",
        progress: Math.min(1, totalTrips),
        maxProgress: 1,
        unlockedAt: totalTrips >= 1 ? sessions[sessions.length - 1]?.startedAt ?? new Date() : null,
      },
      {
        id: "badge-safe-streak",
        code: "safe_streak_3",
        title: "Retour Serein",
        description: "Arriver à destination 3 fois d'affilée en sécurité",
        icon: "shield-checkmark-outline",
        progress: Math.min(3, safeTripsStreak),
        maxProgress: 3,
        unlockedAt: safeTripsStreak >= 3 ? new Date() : null,
      },
      {
        id: "badge-night-owl",
        code: "night_owl",
        title: "Oiseau de Nuit",
        description: "Rentrer sain et sauf d'un trajet de nuit (après 22h)",
        icon: "moon-outline",
        progress: hasNightTrip ? 1 : 0,
        maxProgress: 1,
        unlockedAt: hasNightTrip ? new Date() : null,
      },
      {
        id: "badge-early-bird",
        code: "early_bird",
        title: "L'Éclaireur",
        description: "Arriver premier (🥇) à un rendez-vous de cercle",
        icon: "trophy-outline",
        progress: Math.min(1, meetupPodiums),
        maxProgress: 1,
        unlockedAt: meetupPodiums >= 1 ? new Date() : null,
      },
      {
        id: "badge-meetup-master",
        code: "meetup_master",
        title: "Pilote de Cercle",
        description: "Rejoindre 3 rendez-vous de cercle",
        icon: "people-outline",
        progress: Math.min(3, meetupsJoined),
        maxProgress: 3,
        unlockedAt: meetupsJoined >= 3 ? new Date() : null,
      },
      {
        id: "badge-explorer",
        code: "explorer",
        title: "Explorateur",
        description: "Visiter 3 lieux enregistrés par les cercles",
        icon: "compass-outline",
        progress: Math.min(3, placesVisited),
        maxProgress: 3,
        unlockedAt: placesVisited >= 3 ? new Date() : null,
      },
      {
        id: "badge-centurion",
        code: "centurion",
        title: "Grand Voyageur",
        description: "Compléter 10 partages de position",
        icon: "sparkles-outline",
        progress: Math.min(10, totalTrips),
        maxProgress: 10,
        unlockedAt: totalTrips >= 10 ? new Date() : null,
      },
    ];

    return {
      userId: user.id,
      displayName: user.displayName,
      xp,
      level: currentLevel.level,
      levelTitle: currentLevel.title,
      nextLevelXp: currentLevel.maxXp,
      currentLevelProgress,
      stats,
      badges,
    };
  }
}
