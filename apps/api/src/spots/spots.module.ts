import { Module } from "@nestjs/common";
import { CirclesModule } from "../circles/circles.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SpotsController } from "./spots.controller";
import { SpotsService } from "./spots.service";

@Module({
  imports: [PrismaModule, CirclesModule],
  controllers: [SpotsController],
  providers: [SpotsService],
  exports: [SpotsService],
})
export class SpotsModule {}
