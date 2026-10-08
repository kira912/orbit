import { Module } from "@nestjs/common";
import { LocationRequestsModule } from "../location-requests/location-requests.module";
import { MapReportsModule } from "../map-reports/map-reports.module";
import { MeetupsModule } from "../meetups/meetups.module";
import { ShareSessionsModule } from "../share-sessions/share-sessions.module";
import { MaintenanceService } from "./maintenance.service";

@Module({
  imports: [ShareSessionsModule, MeetupsModule, LocationRequestsModule, MapReportsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
