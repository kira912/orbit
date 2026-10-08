import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { GeofencingModule } from "../geofencing/geofencing.module";
import { ShareSessionsModule } from "../share-sessions/share-sessions.module";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";

@Module({
  imports: [CirclesModule, GeofencingModule, ShareSessionsModule],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
