import { ShareSessionsService } from "./share-sessions.service";
import { PrismaService } from "../prisma/prisma.service";

const DESTINATION = { latitude: 48.8566, longitude: 2.3522 };
const NEAR_DESTINATION = { latitude: 48.85665, longitude: 2.35225 }; // a few meters away
const FAR_FROM_DESTINATION = { latitude: 48.9, longitude: 2.4 };

function buildPrismaMock() {
  return {
    shareSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

function baseSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    circleId: "circle-1",
    destinationLat: DESTINATION.latitude,
    destinationLng: DESTINATION.longitude,
    arrivalRadiusMeters: 75,
    expiresAt: null,
    status: "active",
    startedAt: new Date(),
    endedAt: null,
    ...overrides,
  };
}

describe("ShareSessionsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ShareSessionsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ShareSessionsService(prisma as unknown as PrismaService);
  });

  describe("handleLocationUpdate", () => {
    it("marks a session arrived once the user is within the arrival radius", async () => {
      const session = baseSession();
      prisma.shareSession.findMany.mockResolvedValue([session]);
      prisma.shareSession.update.mockResolvedValue({ ...session, status: "arrived", endedAt: new Date() });

      const updates = await service.handleLocationUpdate("user-1", NEAR_DESTINATION, 1.5);

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ kind: "ended", status: "arrived" });
      expect(prisma.shareSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "arrived" }) }),
      );
    });

    it("returns an ETA update while still far from the destination", async () => {
      const session = baseSession();
      prisma.shareSession.findMany.mockResolvedValue([session]);

      const updates = await service.handleLocationUpdate("user-1", FAR_FROM_DESTINATION, 5);

      expect(updates).toHaveLength(1);
      expect(updates[0].kind).toBe("eta");
      if (updates[0].kind === "eta") {
        expect(updates[0].distanceMeters).toBeGreaterThan(75);
        expect(updates[0].etaSeconds).toBeGreaterThan(0);
      }
      expect(prisma.shareSession.update).not.toHaveBeenCalled();
    });

    it("expires a session whose deadline has passed, even near the destination", async () => {
      const session = baseSession({ expiresAt: new Date(Date.now() - 1000) });
      prisma.shareSession.findMany.mockResolvedValue([session]);
      prisma.shareSession.update.mockResolvedValue({ ...session, status: "expired", endedAt: new Date() });

      const updates = await service.handleLocationUpdate("user-1", FAR_FROM_DESTINATION, 1);

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ kind: "ended", status: "expired" });
    });

    it("skips sessions without a destination (plain live-share, no ETA to compute)", async () => {
      const session = baseSession({ destinationLat: null, destinationLng: null, arrivalRadiusMeters: null });
      prisma.shareSession.findMany.mockResolvedValue([session]);

      const updates = await service.handleLocationUpdate("user-1", FAR_FROM_DESTINATION, 1);

      expect(updates).toEqual([]);
    });
  });

  describe("start", () => {
    it("computes expiresAt from durationMinutes", async () => {
      prisma.shareSession.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "session-2",
          status: "active",
          startedAt: new Date(),
          endedAt: null,
          ...data,
        }),
      );

      const before = Date.now();
      const result = await service.start("user-1", {
        circleId: "circle-1",
        durationMinutes: 30,
      });
      const after = Date.now();

      expect(result.expiresAt).not.toBeNull();
      const expiresAtMs = result.expiresAt!.getTime();
      expect(expiresAtMs).toBeGreaterThanOrEqual(before + 30 * 60_000 - 1000);
      expect(expiresAtMs).toBeLessThanOrEqual(after + 30 * 60_000 + 1000);
    });
  });
});
