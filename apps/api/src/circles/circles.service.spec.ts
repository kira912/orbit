import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CirclesService } from "./circles.service";
import { PrismaService } from "../prisma/prisma.service";

function buildPrismaMock() {
  return {
    circle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    circleMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe("CirclesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CirclesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new CirclesService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("creates the circle with the owner as its first member", async () => {
      prisma.circle.findUnique.mockResolvedValue(null); // invite code is unique
      prisma.circle.create.mockResolvedValue({
        id: "circle-1",
        name: "Family",
        inviteCode: "ABCD1234",
        ownerId: "owner-1",
        createdAt: new Date(),
        members: [
          {
            circleId: "circle-1",
            userId: "owner-1",
            joinedAt: new Date(),
            user: { displayName: "Owner" },
          },
        ],
      });

      const result = await service.create("owner-1", { name: "Family" });

      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe("owner-1");
      expect(prisma.circle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: "owner-1",
            members: { create: { userId: "owner-1" } },
          }),
        }),
      );
    });
  });

  describe("join", () => {
    it("rejects an unknown invite code", async () => {
      prisma.circle.findUnique.mockResolvedValue(null);

      await expect(service.join("user-2", "NOPE0000")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("adds the user as a member when not already one", async () => {
      const circleBeforeJoin = {
        id: "circle-1",
        name: "Family",
        inviteCode: "ABCD1234",
        ownerId: "owner-1",
        createdAt: new Date(),
        members: [
          { circleId: "circle-1", userId: "owner-1", joinedAt: new Date(), user: { displayName: "Owner" } },
        ],
      };
      const circleAfterJoin = {
        ...circleBeforeJoin,
        members: [
          ...circleBeforeJoin.members,
          { circleId: "circle-1", userId: "user-2", joinedAt: new Date(), user: { displayName: "New" } },
        ],
      };
      prisma.circle.findUnique
        .mockResolvedValueOnce(circleBeforeJoin)
        .mockResolvedValueOnce(circleAfterJoin);
      prisma.circleMember.create.mockResolvedValue({});

      const result = await service.join("user-2", "ABCD1234");

      expect(prisma.circleMember.create).toHaveBeenCalledWith({
        data: { circleId: "circle-1", userId: "user-2" },
      });
      expect(result.members.map((m) => m.userId)).toContain("user-2");
    });

    it("is idempotent when the user already belongs to the circle", async () => {
      const circle = {
        id: "circle-1",
        name: "Family",
        inviteCode: "ABCD1234",
        ownerId: "owner-1",
        createdAt: new Date(),
        members: [
          { circleId: "circle-1", userId: "owner-1", joinedAt: new Date(), user: { displayName: "Owner" } },
        ],
      };
      prisma.circle.findUnique.mockResolvedValue(circle);

      await service.join("owner-1", "ABCD1234");

      expect(prisma.circleMember.create).not.toHaveBeenCalled();
    });
  });

  describe("assertMembership", () => {
    it("throws ForbiddenException when the user is not a member", async () => {
      prisma.circleMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assertMembership("stranger", "circle-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("resolves silently when the user is a member", async () => {
      prisma.circleMember.findUnique.mockResolvedValue({ circleId: "circle-1", userId: "u1" });

      await expect(
        service.assertMembership("u1", "circle-1"),
      ).resolves.toBeUndefined();
    });
  });
});
