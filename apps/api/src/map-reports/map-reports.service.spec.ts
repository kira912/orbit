import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MapReportsService } from "./map-reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "../circles/circles.service";
import { LOCATION_EVENTS } from "../locations/location-events";

const NOW = new Date("2026-10-08T18:00:00Z");
const ID = "11111111-1111-1111-1111-111111111111";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    circleId: "c1",
    userId: "ada",
    kind: "accident",
    note: null,
    latitude: 48.85,
    longitude: 2.35,
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 2 * 3_600_000),
    confirmations: 0,
    lastConfirmedAt: null,
    resolvedAt: null,
    resolvedById: null,
    user: { displayName: "Ada" },
    ...overrides,
  };
}

describe("MapReportsService", () => {
  let prisma: { mapReport: Record<string, jest.Mock>; user: Record<string, jest.Mock> };
  let assertMembership: jest.Mock;
  let changes: { change: string; actorName: string }[];
  let service: MapReportsService;

  beforeEach(() => {
    prisma = {
      mapReport: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(row()),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row({ ...data, confirmations: 1 }))),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ displayName: "Bob" }) },
    };
    assertMembership = jest.fn().mockResolvedValue(undefined);
    const events = new EventEmitter2();
    changes = [];
    events.on(LOCATION_EVENTS.MapReportChanged, (e) => changes.push(e));
    service = new MapReportsService(
      prisma as unknown as PrismaService,
      { assertMembership } as unknown as CirclesService,
      events,
    );
  });

  it("gives each kind its own lifetime", async () => {
    await service.create("ada", { circleId: "c1", kind: "traffic", latitude: 48.85, longitude: 2.35 }, NOW);
    await service.create("ada", { circleId: "c1", kind: "roadwork", latitude: 48.85, longitude: 2.35 }, NOW);

    const [traffic, roadwork] = prisma.mapReport.create.mock.calls.map(([{ data }]) => data.expiresAt.getTime());
    expect(traffic - NOW.getTime()).toBe(60 * 60_000);
    expect(roadwork - NOW.getTime()).toBe(7 * 24 * 60 * 60_000);
    expect(changes.map((c) => c.change)).toEqual(["created", "created"]);
  });

  it("caps how many active reports one member can pin", async () => {
    prisma.mapReport.count.mockResolvedValue(20);
    await expect(
      service.create("ada", { circleId: "c1", kind: "danger", latitude: 48.85, longitude: 2.35 }, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("'toujours là' restarts the clock and credits who confirmed", async () => {
    const later = new Date(NOW.getTime() + 30 * 60_000);

    await service.confirm("bob", ID, later);

    expect(prisma.mapReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          confirmations: { increment: 1 },
          lastConfirmedAt: later,
          expiresAt: new Date(later.getTime() + 2 * 3_600_000),
        },
      }),
    );
    expect(changes).toEqual([expect.objectContaining({ change: "confirmed", actorName: "Bob" })]);
  });

  it("checks membership of the report's own circle, not one sent by the client", async () => {
    assertMembership.mockRejectedValue(new ForbiddenException());

    await expect(service.resolve("eve", ID, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertMembership).toHaveBeenCalledWith("eve", "c1");
    expect(prisma.mapReport.update).not.toHaveBeenCalled();
  });

  it("can't act on a report that already left the map", async () => {
    prisma.mapReport.findUnique.mockResolvedValue(row({ expiresAt: new Date(NOW.getTime() - 1) }));
    await expect(service.confirm("bob", ID, NOW)).rejects.toBeInstanceOf(BadRequestException);

    prisma.mapReport.findUnique.mockResolvedValue(row({ resolvedAt: NOW }));
    await expect(service.resolve("bob", ID, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });
});
