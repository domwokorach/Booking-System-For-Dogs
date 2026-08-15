import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module';
import { configureNestApplication } from '../backend/src/bootstrap';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';

let cachedServer: any;

export const handler = async (event: any, context: any) => {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    configureNestApplication(app);
    await app.init();
    cachedServer = serverlessExpress({ app: expressApp });
  }
  return cachedServer(event, context);
};
