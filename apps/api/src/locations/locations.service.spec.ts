import { EventEmitter2 } from "@nestjs/event-emitter";
import { LocationsService } from "./locations.service";
import { LOCATION_EVENTS } from "./location-events";
import { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "../circles/circles.service";
import { GeofencingService } from "../geofencing/geofencing.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";

function buildPrismaMock() {
  return {
    user: { findUniqueOrThrow: jest.fn() },
    locationPing: { create: jest.fn(), findMany: jest.fn() },
    circleMember: { findMany: jest.fn() },
  };
}

describe("LocationsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let circles: jest.Mocked<Pick<CirclesService, "circleIdsForUser" | "assertMembership">>;
  let geofencing: jest.Mocked<Pick<GeofencingService, "evaluate">>;
  let sessions: jest.Mocked<Pick<ShareSessionsService, "handleLocationUpdate">>;
  let events: EventEmitter2;
  let service: LocationsService;

  const input = {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 5,
    speed: 1.2,
    heading: 90,
    recordedAt: new Date("2026-01-01T10:00:00.000Z"),
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    circles = {
      circleIdsForUser: jest.fn().mockResolvedValue(["circle-1", "circle-2"]),
      assertMembership: jest.fn().mockResolvedValue(undefined),
    };
    geofencing = { evaluate: jest.fn().mockResolvedValue([]) };
    sessions = { handleLocationUpdate: jest.fn().mockResolvedValue([]) };
    events = new EventEmitter2();

    prisma.user.findUniqueOrThrow.mockResolvedValue({ displayName: "Ada" });
    prisma.locationPing.create.mockResolvedValue({
      id: "ping-1",
      userId: "user-1",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      speed: input.speed,
      heading: input.heading,
      recordedAt: input.recordedAt,
    });

    service = new LocationsService(
      prisma as unknown as PrismaService,
      circles as unknown as CirclesService,
      geofencing as unknown as GeofencingService,
      sessions as unknown as ShareSessionsService,
      events,
    );
  });

  it("broadcasts a friend-location-updated event per circle the user belongs to", async () => {
    const received: unknown[] = [];
    events.on(LOCATION_EVENTS.FriendLocationUpdated, (payload) => received.push(payload));

    await service.recordPing("user-1", input);

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ circleId: "circle-1", displayName: "Ada", userId: "user-1" });
    expect(received[1]).toMatchObject({ circleId: "circle-2" });
  });

  it("forwards geofence events enriched with the display name", async () => {
    geofencing.evaluate.mockResolvedValue([
      {
        id: "evt-1",
        placeId: "place-1",
        placeName: "Home",
        circleId: "circle-1",
        userId: "user-1",
        type: "enter",
        occurredAt: input.recordedAt,
      },
    ]);
    const received: unknown[] = [];
    events.on(LOCATION_EVENTS.GeofenceEvent, (payload) => received.push(payload));

    await service.recordPing("user-1", input);

    expect(received).toEqual([
      expect.objectContaining({ type: "enter", placeName: "Home", displayName: "Ada" }),
    ]);
  });

  it("emits a session ETA update for an in-progress session", async () => {
    sessions.handleLocationUpdate.mockResolvedValue([
      {
        kind: "eta",
        session: { id: "session-1", circleId: "circle-1" } as never,
        distanceMeters: 500,
        etaSeconds: 300,
      },
    ]);
    const received: unknown[] = [];
    events.on(LOCATION_EVENTS.SessionEtaUpdate, (payload) => received.push(payload));

    await service.recordPing("user-1", input);

    expect(received).toEqual([
      { circleId: "circle-1", sessionId: "session-1", distanceMeters: 500, etaSeconds: 300 },
    ]);
  });

  it("emits a session-ended event when a session wraps up", async () => {
    sessions.handleLocationUpdate.mockResolvedValue([
      {
        kind: "ended",
        session: { id: "session-1", circleId: "circle-1", destinationName: "Maison" } as never,
        status: "arrived",
      },
    ]);
    const received: unknown[] = [];
    events.on(LOCATION_EVENTS.SessionEnded, (payload) => received.push(payload));

    await service.recordPing("user-1", input);

    expect(received).toEqual([
      {
        circleId: "circle-1",
        sessionId: "session-1",
        userId: "user-1",
        displayName: "Ada",
        destinationName: "Maison",
        status: "arrived",
      },
    ]);
  });

  describe("history", () => {
    it("requires both the requester and the target user to share the circle", async () => {
      prisma.locationPing.findMany.mockResolvedValue([]);

      await service.history("requester-1", {
        userId: "target-1",
        circleId: "circle-1",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-02T00:00:00.000Z"),
      });

      expect(circles.assertMembership).toHaveBeenCalledWith("requester-1", "circle-1");
      expect(circles.assertMembership).toHaveBeenCalledWith("target-1", "circle-1");
    });
  });

  describe("latest", () => {
    it("returns the last ping of each circle member with their display name", async () => {
      prisma.circleMember.findMany.mockResolvedValue([
        { userId: "user-1", user: { displayName: "Ada" } },
        { userId: "user-2", user: { displayName: "Bob" } },
      ]);
      prisma.locationPing.findMany.mockResolvedValue([
        { id: "ping-2", userId: "user-2", ...input, batteryLevel: 0.5, batteryCharging: true },
      ]);

      const result = await service.latest("user-1", { circleId: "circle-1" });

      expect(circles.assertMembership).toHaveBeenCalledWith("user-1", "circle-1");
      expect(prisma.locationPing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ["user-1", "user-2"] } },
          distinct: ["userId"],
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          userId: "user-2",
          circleId: "circle-1",
          displayName: "Bob",
          batteryLevel: 0.5,
          batteryCharging: true,
        }),
      ]);
    });

    it("rejects requesters outside the circle", async () => {
      circles.assertMembership.mockRejectedValue(new Error("Not a member"));

      await expect(service.latest("stranger", { circleId: "circle-1" })).rejects.toThrow("Not a member");
      expect(prisma.locationPing.findMany).not.toHaveBeenCalled();
    });
  });
});
