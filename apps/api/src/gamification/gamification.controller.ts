import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { GamificationProfile } from "@orbit/shared";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types";
import { GamificationService } from "./gamification.service";

@Controller("gamification")
@UseGuards(AuthGuard("jwt"))
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get("me")
  async getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<GamificationProfile> {
    return this.gamification.getProfile(user.id);
  }

  @Get("users/:id")
  async getUserProfile(
    @CurrentUser() _user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GamificationProfile> {
    return this.gamification.getProfile(id);
  }
}
