import { Module } from "@nestjs/common";
import { ExpoPushClient } from "./expo-push.client";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushClient],
})
export class NotificationsModule {}
