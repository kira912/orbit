import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { startShareSessionInputSchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CirclesService } from "../circles/circles.service";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ShareSessionsService } from "./share-sessions.service";

@Controller("share-sessions")
@UseGuards(JwtAuthGuard)
export class ShareSessionsController {
  constructor(
    private readonly sessions: ShareSessionsService,
    private readonly circles: CirclesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.listActiveForUser(user.id);
  }

  @Post()
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startShareSessionInputSchema)) body: unknown,
  ) {
    const input = body as { circleId: string };
    await this.circles.assertMembership(user.id, input.circleId);
    return this.sessions.start(user.id, body as never);
  }

  @Post(":id/stop")
  stop(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.sessions.stop(user.id, id);
  }
}
