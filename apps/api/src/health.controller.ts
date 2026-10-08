import { Controller, Get } from "@nestjs/common";

/** Liveness probe for the host (Render): answers without touching the database. */
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}
