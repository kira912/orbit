import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { acceptLocationRequestInputSchema, createLocationRequestInputSchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { LocationRequestsService } from "./location-requests.service";

@Controller("location-requests")
@UseGuards(JwtAuthGuard)
export class LocationRequestsController {
  constructor(private readonly requests: LocationRequestsService) {}

  @Get("incoming")
  incoming(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.incoming(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createLocationRequestInputSchema)) body: unknown,
  ) {
    return this.requests.create(user.id, body as never);
  }

  @Post(":id/accept")
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(acceptLocationRequestInputSchema)) body: unknown,
  ) {
    return this.requests.accept(user.id, id, body as never);
  }

  @Post(":id/decline")
  decline(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.requests.decline(user.id, id);
  }
}
