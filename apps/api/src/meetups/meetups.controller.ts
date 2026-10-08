import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { createMeetupInputSchema, joinMeetupInputSchema, listMeetupsQuerySchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { MeetupsService } from "./meetups.service";

@Controller("meetups")
@UseGuards(JwtAuthGuard)
export class MeetupsController {
  constructor(private readonly meetups: MeetupsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listMeetupsQuerySchema)) query: unknown,
  ) {
    return this.meetups.listActive(user.id, (query as { circleId: string }).circleId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.meetups.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMeetupInputSchema)) body: unknown,
  ) {
    return this.meetups.create(user.id, body as never);
  }

  @Post(":id/join")
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(joinMeetupInputSchema)) body: unknown,
  ) {
    return this.meetups.join(user.id, id, body as never);
  }

  @Post(":id/end")
  end(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.meetups.end(user.id, id);
  }
}
