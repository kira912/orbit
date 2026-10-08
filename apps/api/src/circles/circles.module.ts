import { Module } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { CirclesController } from "./circles.controller";
import { CirclesService } from "./circles.service";

@Module({
  controllers: [CirclesController],
  providers: [CirclesService, ActivityService],
  exports: [CirclesService],
})
export class CirclesModule {}
