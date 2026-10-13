import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  addSpotCommentInputSchema,
  createSpotInputSchema,
  listSpotsQuerySchema,
} from "@orbit/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SpotsService } from "./spots.service";

@Controller("spots")
@UseGuards(JwtAuthGuard)
export class SpotsController {
  constructor(private readonly spots: SpotsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listSpotsQuerySchema)) query: unknown,
  ) {
    return this.spots.list(user.id, query as never);
  }

  @Get(":id")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.spots.getById(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSpotInputSchema)) body: unknown,
  ) {
    return this.spots.create(user.id, body as never);
  }

  @Post(":id/like")
  toggleLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.spots.toggleLike(user.id, id);
  }

  @Post(":id/save")
  toggleSave(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.spots.toggleSave(user.id, id);
  }

  @Post(":id/comments")
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addSpotCommentInputSchema)) body: unknown,
  ) {
    return this.spots.addComment(user.id, id, body as never);
  }

  @Delete(":id")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.spots.delete(user.id, id);
  }
}
