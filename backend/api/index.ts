import { NestFactory } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { configure as serverlessExpress } from "@vendia/serverless-express";
import { AppModule } from "../src/app.module.js";
import { configureNestApplication } from "../src/bootstrap.js";

const expressApp = express();
const adapter = new ExpressAdapter(expressApp);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, adapter, { rawBody: true });
  configureNestApplication(app);
  await app.init();
  return app;
}

const appPromise = bootstrap();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return serverlessExpress({ app: expressApp })(req, res);
}
