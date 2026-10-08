import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LocationRequestsService } from "./location-requests.service";
import { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "../circles/circles.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";
import { LOCATION_EVENTS } from "../locations/location-events";

const FUTURE = new Date(Date.now() + 10 * 60_000);
const ID = "11111111-1111-1111-1111-111111111111";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    circleId: "c1",
    fromUserId: "ada",
    toUserId: "bob",
    status: "pending",
    createdAt: new Date(),
    expiresAt: FUTURE,
    respondedAt: null,
    sessionId: null,
    fromUser: { displayName: "Ada" },
    toUser: { displayName: "Bob" },
    circle: { name: "Famille" },
    ...overrides,
  };
}

describe("LocationRequestsService", () => {
  let prisma: { locationRequest: Record<string, jest.Mock>; shareSession: Record<string, jest.Mock> };
  let sessions: { start: jest.Mock };
  let updates: { change: string }[];
  let service: LocationRequestsService;

  beforeEach(() => {
    prisma = {
      locationRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
      },
      shareSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    sessions = { start: jest.fn().mockResolvedValue({ id: "s1" }) };
    const events = new EventEmitter2();
    updates = [];
    events.on(LOCATION_EVENTS.LocationRequestUpdated, (e) => updates.push(e));
    service = new LocationRequestsService(
      prisma as unknown as PrismaService,
      { assertMembership: jest.fn().mockResolvedValue(undefined) } as unknown as CirclesService,
      sessions as unknown as ShareSessionsService,
      events,
    );
  });

  it("notifies the target of a new request", async () => {
    const request = await service.create("ada", { circleId: "c1", toUserId: "bob" });

    expect(request).toMatchObject({ fromName: "Ada", toName: "Bob", status: "pending" });
    expect(updates).toEqual([expect.objectContaining({ change: "created" })]);
  });

  it("doesn't nag twice: a pending request is returned as is", async () => {
    prisma.locationRequest.findFirst.mockResolvedValue(row());

    await service.create("ada", { circleId: "c1", toUserId: "bob" });

    expect(prisma.locationRequest.create).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("is pointless when the person is already sharing", async () => {
    prisma.shareSession.findFirst.mockResolvedValue({ id: "s0" });
    await expect(service.create("ada", { circleId: "c1", toUserId: "bob" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepting starts a temporary share in that circle", async () => {
    prisma.locationRequest.findUnique.mockResolvedValue(row());

    const request = await service.accept("bob", ID, { durationMinutes: 15 });

    expect(sessions.start).toHaveBeenCalledWith("bob", { circleId: "c1", durationMinutes: 15 });
    expect(request.status).toBe("accepted");
    expect(updates).toEqual([expect.objectContaining({ change: "accepted" })]);
  });

  it("only the target can answer", async () => {
    prisma.locationRequest.findUnique.mockResolvedValue(row());
    await expect(service.accept("ada", ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.decline("eve", ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("can't answer an expired request", async () => {
    prisma.locationRequest.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.accept("bob", ID, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.start).not.toHaveBeenCalled();
  });
});
