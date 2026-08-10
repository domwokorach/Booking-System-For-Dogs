import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  ExpressAdapter,
  type NestExpressApplication,
} from "@nestjs/platform-express";
import type { IncomingMessage, ServerResponse } from "node:http";

import { AppModule } from "../src/app.module.js";
import { configureNestApplication } from "../src/bootstrap.js";

type NestServer = {
  app: NestExpressApplication;
  requestHandler: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void;
};

let nestServerPromise: Promise<NestServer> | undefined;

async function bootstrapNestServer(): Promise<NestServer> {
  // Use the Express instance bundled with Nest's adapter. Nest 11 uses
  // Express 5 internally, while the legacy direct dependency remains v4.
  const adapter = new ExpressAdapter();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    adapter,
  );

  try {
    configureNestApplication(app, { enableShutdownHooks: false });
    await app.init();

    const requestHandler = adapter.getInstance() as NestServer["requestHandler"];
    return { app, requestHandler };
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

function getNestServer(): Promise<NestServer> {
  nestServerPromise ??= bootstrapNestServer().catch((error: unknown) => {
    nestServerPromise = undefined;
    throw error;
  });

  return nestServerPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const { requestHandler } = await getNestServer();
  requestHandler(request, response);
}
