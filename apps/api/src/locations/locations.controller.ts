import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  latestLocationsQuerySchema,
  locationHistoryQuerySchema,
  locationPingInputSchema,
} from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  /**
   * REST fallback for the background task when no WebSocket connection is
   * available (e.g. app backgrounded and the socket dropped). The primary
   * path in normal foreground/background operation is the gateway.
   */
  @Post("ping")
  ping(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(locationPingInputSchema)) body: unknown,
  ) {
    return this.locations.recordPing(user.id, body as never);
  }

  @Get("latest")
  latest(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(latestLocationsQuerySchema)) query: unknown,
  ) {
    return this.locations.latest(user.id, query as never);
  }

  @Get("history")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(locationHistoryQuerySchema)) query: unknown,
  ) {
    return this.locations.history(user.id, query as never);
  }
}
