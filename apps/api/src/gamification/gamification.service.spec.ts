import { Test, TestingModule } from "@nestjs/testing";
import { GamificationService } from "./gamification.service";
import { PrismaService } from "../prisma/prisma.service";

describe("GamificationService", () => {
  let service: GamificationService;
  let prisma: {
    user: { findUnique: jest.Mock };
    shareSession: { findMany: jest.Mock };
    meetup: { findMany: jest.Mock };
    geofenceEvent: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1", displayName: "Ada" }),
      },
      shareSession: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "s1",
            userId: "user-1",
            status: "arrived",
            meetupId: "m1",
            startedAt: new Date("2026-10-10T10:00:00Z"),
            endedAt: new Date("2026-10-10T10:30:00Z"),
          },
          {
            id: "s2",
            userId: "user-1",
            status: "arrived",
            meetupId: null,
            startedAt: new Date("2026-10-11T12:00:00Z"),
            endedAt: new Date("2026-10-11T12:20:00Z"),
          },
        ]),
      },
      meetup: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "m1",
            sessions: [
              { userId: "user-1", status: "arrived", endedAt: new Date("2026-10-10T10:30:00Z") },
            ],
          },
        ]),
      },
      geofenceEvent: {
        findMany: jest.fn().mockResolvedValue([
          { placeId: "p1", type: "enter" },
          { placeId: "p2", type: "enter" },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it("should calculate user gamification profile with XP, level, and badges", async () => {
    const profile = await service.getProfile("user-1");

    expect(profile.userId).toBe("user-1");
    expect(profile.displayName).toBe("Ada");
    expect(profile.stats.totalTrips).toBe(2);
    expect(profile.stats.safeTripsStreak).toBe(2);
    expect(profile.stats.meetupsJoined).toBe(1);
    expect(profile.stats.meetupPodiums).toBe(1);
    expect(profile.stats.placesVisited).toBe(2);

    expect(profile.xp).toBeGreaterThan(0);
    expect(profile.level).toBeGreaterThanOrEqual(1);

    const firstTripBadge = profile.badges.find((b) => b.code === "first_trip");
    expect(firstTripBadge?.unlockedAt).not.toBeNull();

    const earlyBirdBadge = profile.badges.find((b) => b.code === "early_bird");
    expect(earlyBirdBadge?.unlockedAt).not.toBeNull();
  });
});
