import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocationRequestsService } from "../location-requests/location-requests.service";
import { MapReportsService } from "../map-reports/map-reports.service";
import { MeetupsService } from "../meetups/meetups.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShareSessionsService } from "../share-sessions/share-sessions.service";

const EXPIRY_SWEEP_MS = 60_000;
const RETENTION_SWEEP_MS = 60 * 60_000;
const DEFAULT_PING_RETENTION_DAYS = 7;

/**
 * Periodic housekeeping, kept in-process (single API instance at MVP scale):
 * - ends sessions and meetups whose deadline passed while no ping came in,
 *   and lapses unanswered "Tu es où ?" requests;
 * - raises "Rentre bien" alerts on watched trips that look wrong;
 * - forgets map reports gone for a week;
 * - deletes positions older than PING_RETENTION_DAYS: sharing is meant to be
 *   temporary, so its trace shouldn't outlive it for long either.
 */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: ShareSessionsService,
    private readonly meetups: MeetupsService,
    private readonly requests: LocationRequestsService,
    private readonly reports: MapReportsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const every = (ms: number, job: () => Promise<unknown>) => {
      const timer = setInterval(() => {
        job().catch((err) => this.logger.warn(`Maintenance job failed: ${(err as Error).message}`));
      }, ms);
      timer.unref();
      this.timers.push(timer);
    };
    every(EXPIRY_SWEEP_MS, async () => {
      await this.expireDue();
      await this.sessions.checkSafety();
    });
    every(RETENTION_SWEEP_MS, async () => {
      await this.purgeOldPings();
      await this.reports.purgeOld();
    });
    void this.purgeOldPings().catch(() => undefined);
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  async expireDue() {
    await this.meetups.expireDue();
    await this.sessions.expireDue();
    await this.requests.expireDue();
  }

  async purgeOldPings(): Promise<number> {
    const days = Number(this.config.get("PING_RETENTION_DAYS") ?? DEFAULT_PING_RETENTION_DAYS);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const { count } = await this.prisma.locationPing.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    if (count > 0) this.logger.log(`Purged ${count} location pings older than ${days} days`);
    return count;
  }
}
