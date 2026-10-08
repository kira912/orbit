import { Module } from "@nestjs/common";
import { LocationRequestsModule } from "../location-requests/location-requests.module";
import { MeetupsModule } from "../meetups/meetups.module";
import { ShareSessionsModule } from "../share-sessions/share-sessions.module";
import { MaintenanceService } from "./maintenance.service";

@Module({
  imports: [ShareSessionsModule, MeetupsModule, LocationRequestsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
