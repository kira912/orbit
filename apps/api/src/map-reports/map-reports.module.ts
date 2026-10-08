import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { MapReportsController } from "./map-reports.controller";
import { MapReportsService } from "./map-reports.service";

@Module({
  imports: [CirclesModule],
  controllers: [MapReportsController],
  providers: [MapReportsService],
  exports: [MapReportsService],
})
export class MapReportsModule {}
