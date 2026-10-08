import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { createMapReportInputSchema, listMapReportsQuerySchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { MapReportsService } from "./map-reports.service";

@Controller("map-reports")
@UseGuards(JwtAuthGuard)
export class MapReportsController {
  constructor(private readonly reports: MapReportsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listMapReportsQuerySchema)) query: unknown,
  ) {
    return this.reports.listActive(user.id, (query as { circleId: string }).circleId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMapReportInputSchema)) body: unknown,
  ) {
    return this.reports.create(user.id, body as never);
  }

  @Post(":id/confirm")
  confirm(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.reports.confirm(user.id, id);
  }

  @Post(":id/resolve")
  resolve(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.reports.resolve(user.id, id);
  }
}
