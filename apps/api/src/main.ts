import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: config.get("CORS_ORIGIN") ?? "*" });

  const port = config.get("PORT") ?? 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`orbit-api listening on :${port}`);
}

bootstrap();
