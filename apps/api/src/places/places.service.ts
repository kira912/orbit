import { Injectable } from "@nestjs/common";
import type { CreatePlaceInput, Place } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePlaceInput): Promise<Place> {
    return this.prisma.place.create({ data: input });
  }

  async listForCircle(circleId: string): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: { circleId },
      orderBy: { createdAt: "asc" },
    });
  }

  async delete(placeId: string): Promise<void> {
    await this.prisma.place.delete({ where: { id: placeId } });
  }
}
