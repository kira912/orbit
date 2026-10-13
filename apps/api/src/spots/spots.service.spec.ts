import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SpotsService } from "./spots.service";
import { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "../circles/circles.service";
import { LOCATION_EVENTS } from "../locations/location-events";

const NOW = new Date("2026-10-13T14:00:00Z");
const SPOT_ID = "22222222-2222-2222-2222-222222222222";

function spotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SPOT_ID,
    title: "Secret Rooftop",
    description: "Superbe vue sur la ville",
    category: "viewpoint",
    visibility: "circle",
    latitude: 48.8566,
    longitude: 2.3522,
    address: "Paris",
    tags: ["sunset", "vue"],
    createdById: "user-1",
    circleId: "circle-1",
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: { displayName: "Alice", pictureUrl: null },
    circle: { name: "Amis" },
    _count: { likes: 3, comments: 2 },
    likes: [],
    savedBy: [],
    ...overrides,
  };
}

describe("SpotsService", () => {
  let prisma: {
    spot: Record<string, jest.Mock>;
    spotLike: Record<string, jest.Mock>;
    spotComment: Record<string, jest.Mock>;
    spotSaved: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };
  let assertMembership: jest.Mock;
  let circleIdsForUser: jest.Mock;
  let events: EventEmitter2;
  let changes: unknown[];
  let service: SpotsService;

  beforeEach(() => {
    prisma = {
      spot: {
        findMany: jest.fn().mockResolvedValue([spotRow()]),
        findUnique: jest.fn().mockResolvedValue(spotRow()),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(spotRow(data))),
        delete: jest.fn().mockResolvedValue(spotRow()),
      },
      spotLike: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "like-1" }),
        delete: jest.fn().mockResolvedValue({ id: "like-1" }),
        count: jest.fn().mockResolvedValue(4),
      },
      spotComment: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "comment-1",
            ...data,
            createdAt: NOW,
            user: { displayName: "Bob", pictureUrl: null },
          }),
        ),
      },
      spotSaved: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "saved-1" }),
        delete: jest.fn().mockResolvedValue({ id: "saved-1" }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ displayName: "Bob" }),
      },
    };
    assertMembership = jest.fn().mockResolvedValue(undefined);
    circleIdsForUser = jest.fn().mockResolvedValue(["circle-1"]);
    events = new EventEmitter2();
    changes = [];
    events.on(LOCATION_EVENTS.SpotChanged, (e) => changes.push(e));

    service = new SpotsService(
      prisma as unknown as PrismaService,
      { assertMembership, circleIdsForUser } as unknown as CirclesService,
      events,
    );
  });

  it("lists spots with circle and public filtering", async () => {
    const list = await service.list("user-1", {});
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Secret Rooftop");
    expect(circleIdsForUser).toHaveBeenCalledWith("user-1");
  });

  it("creates a circle spot and verifies membership", async () => {
    const created = await service.create("user-1", {
      title: "Cascade cachée",
      category: "nature",
      visibility: "circle",
      circleId: "circle-1",
      latitude: 48.86,
      longitude: 2.34,
      tags: ["nature"],
    });

    expect(assertMembership).toHaveBeenCalledWith("user-1", "circle-1");
    expect(created.title).toBe("Cascade cachée");
    expect(changes).toHaveLength(1);
  });

  it("rejects circle spot without circleId", async () => {
    await expect(
      service.create("user-1", {
        title: "Test",
        category: "nature",
        visibility: "circle",
        latitude: 48.86,
        longitude: 2.34,
        tags: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("toggles likes and emits realtime update", async () => {
    const result = await service.toggleLike("user-2", SPOT_ID);
    expect(result.liked).toBe(true);
    expect(result.likesCount).toBe(4);
    expect(prisma.spotLike.create).toHaveBeenCalled();
    expect(changes).toHaveLength(1);
  });

  it("adds comments on a spot", async () => {
    const comment = await service.addComment("user-2", SPOT_ID, {
      message: "Endroit incroyable au coucher du soleil !",
    });

    expect(comment.message).toBe("Endroit incroyable au coucher du soleil !");
    expect(prisma.spotComment.create).toHaveBeenCalled();
    expect(changes).toHaveLength(1);
  });

  it("only creator can delete their spot", async () => {
    await expect(service.delete("other-user", SPOT_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await service.delete("user-1", SPOT_ID);
    expect(prisma.spot.delete).toHaveBeenCalledWith({ where: { id: SPOT_ID } });
  });
});
