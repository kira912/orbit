import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CirclesModule } from "../circles/circles.module";
import { LocationsModule } from "../locations/locations.module";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [JwtModule.register({}), CirclesModule, LocationsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
