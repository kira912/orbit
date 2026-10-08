import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { createCircleInputSchema, joinCircleInputSchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CirclesService } from "./circles.service";

@Controller("circles")
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.circles.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCircleInputSchema)) body: unknown,
  ) {
    return this.circles.create(user.id, body as never);
  }

  @Post("join")
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(joinCircleInputSchema)) body: unknown,
  ) {
    return this.circles.join(user.id, (body as { inviteCode: string }).inviteCode);
  }
}
