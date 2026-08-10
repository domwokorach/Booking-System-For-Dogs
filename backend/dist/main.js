import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureNestApplication } from "./bootstrap.js";
import { env } from "./config/env.js";
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    configureNestApplication(app);
    await app.listen(env.PORT, "0.0.0.0");
    Logger.log(`Backend API listening on port ${env.PORT}`, "Bootstrap");
}
void bootstrap();
