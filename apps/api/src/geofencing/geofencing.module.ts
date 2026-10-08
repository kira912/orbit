import { Module } from "@nestjs/common";
import { GeofencingService } from "./geofencing.service";

@Module({
  providers: [GeofencingService],
  exports: [GeofencingService],
})
export class GeofencingModule {}
