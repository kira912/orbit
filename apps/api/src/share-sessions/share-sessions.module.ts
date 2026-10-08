import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { ShareSessionsController } from "./share-sessions.controller";
import { ShareSessionsService } from "./share-sessions.service";

@Module({
  imports: [CirclesModule],
  controllers: [ShareSessionsController],
  providers: [ShareSessionsService],
  exports: [ShareSessionsService],
})
export class ShareSessionsModule {}
