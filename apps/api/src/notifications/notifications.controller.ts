import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { registerPushTokenInputSchema } from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";

@Controller("users/me/push-tokens")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerPushTokenInputSchema)) body: unknown,
  ) {
    await this.notifications.registerToken(user.id, (body as { token: string }).token);
    return { success: true };
  }

  /** Called on logout, so a shared device stops receiving the previous user's alerts. */
  @Delete(":token")
  @HttpCode(200)
  async unregister(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string) {
    await this.notifications.unregisterToken(user.id, token);
    return { success: true };
  }
}
