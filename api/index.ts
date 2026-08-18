import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module.js';
import { configureNestApplication } from '../backend/src/bootstrap.js';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';

let cachedApp: Express | undefined;

async function getApp(): Promise<Express> {
  if (!cachedApp) {
    const expressApp = express();
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(expressApp),
      { bodyParser: false, rawBody: true },
    );
    configureNestApplication(app);
    await app.init();
    cachedApp = expressApp;
  }
  return cachedApp;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  app(req, res);
}
