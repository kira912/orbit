import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { ShareSessionsModule } from "../share-sessions/share-sessions.module";
import { LocationRequestsController } from "./location-requests.controller";
import { LocationRequestsService } from "./location-requests.service";

@Module({
  imports: [CirclesModule, ShareSessionsModule],
  controllers: [LocationRequestsController],
  providers: [LocationRequestsService],
  exports: [LocationRequestsService],
})
export class LocationRequestsModule {}
