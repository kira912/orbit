import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { createPlaceInputSchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CirclesService } from "../circles/circles.service";
import { PlacesService } from "./places.service";

@Controller("places")
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(
    private readonly places: PlacesService,
    private readonly circles: CirclesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("circleId") circleId: string,
  ) {
    await this.circles.assertMembership(user.id, circleId);
    return this.places.listForCircle(circleId);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPlaceInputSchema)) body: unknown,
  ) {
    const input = body as { circleId: string };
    await this.circles.assertMembership(user.id, input.circleId);
    return this.places.create(body as never);
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("circleId") circleId: string,
  ) {
    await this.circles.assertMembership(user.id, circleId);
    await this.places.delete(id);
    return { success: true };
  }
}
