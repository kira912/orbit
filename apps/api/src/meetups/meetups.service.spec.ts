import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MeetupsService } from "./meetups.service";
import { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "../circles/circles.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";

const FUTURE = new Date(Date.now() + 3_600_000);

function meetupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    circleId: "circle-1",
    createdById: "user-1",
    name: "Le Comptoir",
    latitude: 48.85,
    longitude: 2.35,
    status: "active",
    createdAt: new Date(),
    endsAt: FUTURE,
    endedAt: null,
    ...overrides,
  };
}

describe("MeetupsService", () => {
  let prisma: {
    meetup: Record<string, jest.Mock>;
    shareSession: Record<string, jest.Mock>;
  };
  let sessions: jest.Mocked<Pick<ShareSessionsService, "start" | "end" | "toDto">>;
  let service: MeetupsService;

  beforeEach(() => {
    prisma = {
      meetup: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      shareSession: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    sessions = {
      start: jest.fn().mockResolvedValue({ id: "session-1" }),
      end: jest.fn().mockResolvedValue([]),
      toDto: jest.fn((s) => s),
    } as never;
    const circles = { assertMembership: jest.fn().mockResolvedValue(undefined) };
    service = new MeetupsService(
      prisma as unknown as PrismaService,
      circles as unknown as CirclesService,
      sessions as unknown as ShareSessionsService,
      new EventEmitter2(),
    );
  });

  describe("join", () => {
    it("starts a session toward the meeting point that ends with the meetup", async () => {
      prisma.meetup.findUnique.mockResolvedValue(meetupRow());
      prisma.shareSession.findFirst.mockResolvedValue(null);

      await service.join("user-2", "11111111-1111-1111-1111-111111111111", {});

      expect(sessions.start).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({
          circleId: "circle-1",
          destination: { latitude: 48.85, longitude: 2.35 },
          destinationName: "Le Comptoir",
        }),
        { meetupId: "11111111-1111-1111-1111-111111111111", expiresAt: FUTURE },
      );
    });

    it("doesn't start a second session when already en route", async () => {
      prisma.meetup.findUnique.mockResolvedValue(meetupRow());
      prisma.shareSession.findFirst.mockResolvedValue({ id: "existing" });

      const session = await service.join("user-2", "11111111-1111-1111-1111-111111111111", {});

      expect(sessions.start).not.toHaveBeenCalled();
      expect(session).toEqual({ id: "existing" });
    });

    it("refuses to join an ended meetup", async () => {
      prisma.meetup.findUnique.mockResolvedValue(meetupRow({ status: "ended" }));
      await expect(service.join("user-2", "x", {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("end", () => {
    it("is reserved to the organizer", async () => {
      prisma.meetup.findUnique.mockResolvedValue(meetupRow());
      await expect(service.end("user-2", "x")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("stops the sessions still heading there", async () => {
      prisma.meetup.findUnique.mockResolvedValue({
        ...meetupRow(),
        createdBy: { displayName: "Ada" },
        sessions: [],
      });
      prisma.meetup.findMany.mockResolvedValue([meetupRow()]);
      prisma.shareSession.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

      await service.end("user-1", "11111111-1111-1111-1111-111111111111");

      expect(prisma.meetup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "ended" }) }),
      );
      expect(sessions.end).toHaveBeenCalledWith(["s1", "s2"], "stopped", expect.any(Date));
    });
  });
});
