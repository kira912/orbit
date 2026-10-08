import { EventEmitter2 } from "@nestjs/event-emitter";
import { ShareSessionsService } from "./share-sessions.service";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_EVENTS } from "../locations/location-events";

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
    locationPing: { findFirst: jest.fn() },
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
    service = new ShareSessionsService(prisma as unknown as PrismaService, new EventEmitter2());
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
          user: { displayName: "Ada" },
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

    it("only creates a public token when a public link is requested", async () => {
      prisma.shareSession.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "s", status: "active", startedAt: new Date(), endedAt: null, user: { displayName: "Ada" }, ...data }),
      );

      const privateSession = await service.start("user-1", { circleId: "circle-1" });
      const publicSession = await service.start("user-1", { circleId: "circle-1", publicLink: true });

      expect(privateSession.publicToken).toBeNull();
      expect(publicSession.publicToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    });

    it("tells the circle that the user started sharing", async () => {
      const events = new EventEmitter2();
      const received: unknown[] = [];
      events.on(LOCATION_EVENTS.SessionStarted, (payload) => received.push(payload));
      service = new ShareSessionsService(prisma as unknown as PrismaService, events);
      prisma.shareSession.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "s", status: "active", startedAt: new Date(), endedAt: null, user: { displayName: "Ada" }, ...data }),
      );

      await service.start("user-1", { circleId: "circle-1", destination: DESTINATION, destinationName: "Maison" });

      expect(received).toEqual([
        expect.objectContaining({ circleId: "circle-1", userId: "user-1", displayName: "Ada", destinationName: "Maison" }),
      ]);
    });
  });

  describe("getPublic", () => {
    it("hides the position once the session has ended", async () => {
      prisma.shareSession.findUnique.mockResolvedValue(
        baseSession({ status: "arrived", endedAt: new Date(), user: { displayName: "Ada" }, destinationName: "Maison" }),
      );

      const view = await service.getPublic("token-token-token-token");

      expect(view).toMatchObject({ status: "arrived", position: null, etaSeconds: null });
      expect(prisma.locationPing.findFirst).not.toHaveBeenCalled();
    });

    it("only reads positions recorded since the session started", async () => {
      const startedAt = new Date("2026-01-01T10:00:00Z");
      prisma.shareSession.findUnique.mockResolvedValue(baseSession({ startedAt, user: { displayName: "Ada" } }));
      prisma.locationPing.findFirst.mockResolvedValue({ ...FAR_FROM_DESTINATION, accuracy: 5, speed: 1, batteryLevel: 0.5, recordedAt: new Date() });

      const view = await service.getPublic("token-token-token-token");

      expect(prisma.locationPing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1", createdAt: { gte: startedAt } } }),
      );
      expect(view.position).toMatchObject(FAR_FROM_DESTINATION);
      expect(view.etaSeconds).toBeGreaterThan(0);
    });

    it("rejects unknown tokens", async () => {
      prisma.shareSession.findUnique.mockResolvedValue(null);
      await expect(service.getPublic("nope-nope-nope-nope")).rejects.toThrow("Unknown link");
    });
  });
});
