import { Controller, Get, Header, NotFoundException, Param } from "@nestjs/common";
import { renderPublicSharePage } from "./public-share.page";
import { ShareSessionsService } from "./share-sessions.service";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Unauthenticated, read-only access to a session through its public link. */
@Controller()
export class PublicShareController {
  constructor(private readonly sessions: ShareSessionsService) {}

  @Get("public/sessions/:token")
  @Header("Cache-Control", "no-store")
  data(@Param("token") token: string) {
    if (!TOKEN_PATTERN.test(token)) throw new NotFoundException("Unknown link");
    return this.sessions.getPublic(token);
  }

  @Get("s/:token")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  page(@Param("token") token: string) {
    if (!TOKEN_PATTERN.test(token)) throw new NotFoundException("Unknown link");
    return renderPublicSharePage(token);
  }
}
