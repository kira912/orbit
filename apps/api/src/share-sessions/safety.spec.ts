import { EventEmitter2 } from "@nestjs/event-emitter";
import { ShareSessionsService } from "./share-sessions.service";
import { PrismaService } from "../prisma/prisma.service";
import { LOCATION_EVENTS } from "../locations/location-events";

const NOW = new Date("2026-10-08T18:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const DESTINATION = { latitude: 48.8566, longitude: 2.3522 };
const FAR = { latitude: 48.8766, longitude: 2.3322 }; // ~2.6 km away

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    userId: "ada",
    circleId: "c1",
    destinationLat: DESTINATION.latitude,
    destinationLng: DESTINATION.longitude,
    destinationName: "Maison",
    arrivalRadiusMeters: 75,
    expiresAt: null,
    status: "active",
    startedAt: minutesAgo(30),
    endedAt: null,
    publicToken: null,
    meetupId: null,
    safetyAlerts: true,
    expectedArrivalAt: minutesAgo(5),
    lateAlertAt: null,
    stalledAlertAt: null,
    silentAlertAt: null,
    lastOkAt: null,
    user: { displayName: "Ada" },
    ...overrides,
  };
}

const ping = (minutes: number, point = FAR) => ({ ...point, createdAt: minutesAgo(minutes) });

describe("ShareSessionsService – Rentre bien", () => {
  let prisma: {
    shareSession: Record<string, jest.Mock>;
    locationPing: Record<string, jest.Mock>;
  };
  let alerts: unknown[];
  let service: ShareSessionsService;

  beforeEach(() => {
    prisma = {
      shareSession: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      locationPing: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const events = new EventEmitter2();
    alerts = [];
    events.on(LOCATION_EVENTS.SessionAlert, (e) => alerts.push(e));
    service = new ShareSessionsService(prisma as unknown as PrismaService, events);
  });

  it("raises 'silent' when no position came in for 10 minutes", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session()]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(12));

    await service.checkSafety(NOW);

    expect(alerts).toEqual([expect.objectContaining({ kind: "silent", displayName: "Ada", sessionId: "s1" })]);
    expect(prisma.shareSession.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { silentAlertAt: NOW } });
  });

  it("raises 'late' 15 minutes after the expected arrival", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session({ expectedArrivalAt: minutesAgo(16) })]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(1));

    await service.checkSafety(NOW);

    expect(alerts).toEqual([expect.objectContaining({ kind: "late" })]);
  });

  it("doesn't call someone late within the grace period", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session({ expectedArrivalAt: minutesAgo(10) })]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(1));

    await service.checkSafety(NOW);

    expect(alerts).toEqual([]);
  });

  it("raises 'stalled' when stuck far from the destination for 10 minutes", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session({ expectedArrivalAt: null })]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(1));
    prisma.locationPing.findMany.mockResolvedValue([ping(9), ping(5), ping(1)]);

    await service.checkSafety(NOW);

    expect(alerts).toEqual([expect.objectContaining({ kind: "stalled" })]);
  });

  it("doesn't call 'stalled' someone who keeps moving", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session({ expectedArrivalAt: null })]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(1));
    prisma.locationPing.findMany.mockResolvedValue([ping(9, DESTINATION), ping(1)]);

    await service.checkSafety(NOW);

    expect(alerts).toEqual([]);
  });

  it("raises each alert once until the person says all is well", async () => {
    prisma.shareSession.findMany.mockResolvedValue([session({ silentAlertAt: minutesAgo(3) })]);
    prisma.locationPing.findFirst.mockResolvedValue(ping(15));

    await service.checkSafety(NOW);

    expect(alerts).toEqual([]);
  });

  it("'tout va bien' reassures the circle and gives 15 more minutes", async () => {
    prisma.shareSession.findUnique.mockResolvedValue(session({ lateAlertAt: minutesAgo(2), expectedArrivalAt: minutesAgo(20) }));
    prisma.shareSession.update.mockImplementation(({ data }) => Promise.resolve(session({ ...data })));

    const result = await service.markOk("ada", "s1", NOW);

    expect(prisma.shareSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { lastOkAt: NOW, expectedArrivalAt: new Date(NOW.getTime() + 15 * 60_000) },
    });
    expect(alerts).toEqual([expect.objectContaining({ kind: "ok" })]);
    expect(result.alert).toBeNull();
  });

  it("stays quiet on 'tout va bien' when nobody was alerted", async () => {
    prisma.shareSession.findUnique.mockResolvedValue(session());
    prisma.shareSession.update.mockImplementation(({ data }) => Promise.resolve(session({ ...data })));

    await service.markOk("ada", "s1", NOW);

    expect(alerts).toEqual([]);
  });
});
