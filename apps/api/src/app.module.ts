import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./auth/auth.module";
import { CirclesModule } from "./circles/circles.module";
import { GeofencingModule } from "./geofencing/geofencing.module";
import { HealthController } from "./health.controller";
import { LocationRequestsModule } from "./location-requests/location-requests.module";
import { LocationsModule } from "./locations/locations.module";
import { MapReportsModule } from "./map-reports/map-reports.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { MeetupsModule } from "./meetups/meetups.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlacesModule } from "./places/places.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ShareSessionsModule } from "./share-sessions/share-sessions.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CirclesModule,
    PlacesModule,
    GeofencingModule,
    ShareSessionsModule,
    LocationsModule,
    MeetupsModule,
    LocationRequestsModule,
    MapReportsModule,
    NotificationsModule,
    MaintenanceModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
