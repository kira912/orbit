import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ExpoPushClient } from "./expo-push.client";

describe("NotificationsService", () => {
  let prisma: { pushToken: Record<string, jest.Mock> };
  let push: { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      pushToken: {
        findMany: jest.fn().mockResolvedValue([{ token: "ExponentPushToken[bob]" }]),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    push = { send: jest.fn().mockResolvedValue([]) };
    service = new NotificationsService(prisma as unknown as PrismaService, push as unknown as ExpoPushClient);
  });

  it("notifies the rest of the circle, never the person who arrived", async () => {
    await service.onSessionEnded({
      circleId: "circle-1",
      sessionId: "s",
      userId: "ada",
      displayName: "Ada",
      destinationName: "Maison",
      status: "arrived",
    });

    expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: { not: "ada" }, user: { memberships: { some: { circleId: "circle-1" } } } },
      }),
    );
    expect(push.send).toHaveBeenCalledWith([
      expect.objectContaining({ to: "ExponentPushToken[bob]", title: "Ada est bien arrivé·e ✓", body: "À Maison" }),
    ]);
  });

  it("stays quiet when a session merely expires or is stopped", async () => {
    for (const status of ["expired", "stopped"] as const) {
      await service.onSessionEnded({
        circleId: "circle-1",
        sessionId: "s",
        userId: "ada",
        displayName: "Ada",
        destinationName: null,
        status,
      });
    }
    expect(push.send).not.toHaveBeenCalled();
  });

  it("forgets tokens Expo reports as unregistered", async () => {
    push.send.mockResolvedValue(["ExponentPushToken[bob]"]);

    await service.onMeetupCreated({ circleId: "c", meetupId: "m", userId: "ada", displayName: "Ada", name: "Bar" });

    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["ExponentPushToken[bob]"] } },
    });
  });
});
