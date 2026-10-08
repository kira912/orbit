import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { ShareSessionsModule } from "../share-sessions/share-sessions.module";
import { MeetupsController } from "./meetups.controller";
import { MeetupsService } from "./meetups.service";

@Module({
  imports: [CirclesModule, ShareSessionsModule],
  controllers: [MeetupsController],
  providers: [MeetupsService],
  exports: [MeetupsService],
})
export class MeetupsModule {}
