import { GeofencingService } from "./geofencing.service";
import { PrismaService } from "../prisma/prisma.service";

const HOME = { latitude: 48.8566, longitude: 2.3522 };
const FAR_AWAY = { latitude: 40.7128, longitude: -74.006 };

function buildPrismaMock() {
  return {
    place: { findMany: jest.fn() },
    geofenceEvent: { findFirst: jest.fn(), create: jest.fn() },
  };
}

describe("GeofencingService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: GeofencingService;

  const place = {
    id: "place-1",
    circleId: "circle-1",
    name: "Home",
    latitude: HOME.latitude,
    longitude: HOME.longitude,
    radiusMeters: 100,
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new GeofencingService(prisma as unknown as PrismaService);
  });

  it("returns nothing when the user belongs to no circle", async () => {
    const events = await service.evaluate("user-1", [], HOME, new Date());
    expect(events).toEqual([]);
    expect(prisma.place.findMany).not.toHaveBeenCalled();
  });

  it("emits an enter event on first arrival inside a place", async () => {
    prisma.place.findMany.mockResolvedValue([place]);
    prisma.geofenceEvent.findFirst.mockResolvedValue(null);
    prisma.geofenceEvent.create.mockResolvedValue({ id: "event-1" });

    const events = await service.evaluate(
      "user-1",
      ["circle-1"],
      HOME,
      new Date(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "enter", placeId: "place-1" });
  });

  it("does not re-emit enter while the user stays inside", async () => {
    prisma.place.findMany.mockResolvedValue([place]);
    prisma.geofenceEvent.findFirst.mockResolvedValue({ type: "enter" });

    const events = await service.evaluate(
      "user-1",
      ["circle-1"],
      HOME,
      new Date(),
    );

    expect(events).toEqual([]);
    expect(prisma.geofenceEvent.create).not.toHaveBeenCalled();
  });

  it("emits an exit event once the user leaves after having entered", async () => {
    prisma.place.findMany.mockResolvedValue([place]);
    prisma.geofenceEvent.findFirst.mockResolvedValue({ type: "enter" });
    prisma.geofenceEvent.create.mockResolvedValue({ id: "event-2" });

    const events = await service.evaluate(
      "user-1",
      ["circle-1"],
      FAR_AWAY,
      new Date(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "exit", placeId: "place-1" });
  });

  it("stays silent outside a place with no prior history", async () => {
    prisma.place.findMany.mockResolvedValue([place]);
    prisma.geofenceEvent.findFirst.mockResolvedValue(null);

    const events = await service.evaluate(
      "user-1",
      ["circle-1"],
      FAR_AWAY,
      new Date(),
    );

    expect(events).toEqual([]);
    expect(prisma.geofenceEvent.create).not.toHaveBeenCalled();
  });
});
