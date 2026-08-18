import type { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "node:path";

import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js";
import { env } from "./config/env.js";

export function configureNestApplication(
  app: NestExpressApplication,
  options: { enableShutdownHooks?: boolean } = {},
): void {
  app.useBodyParser("json", { limit: "1mb" });
  app.useStaticAssets(join(process.cwd(), "uploads"), {
    prefix: "/uploads/",
  });
  app.enableCors({
    origin: env.CLIENT_ORIGINS,
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  if (options.enableShutdownHooks ?? true) {
    app.enableShutdownHooks();
  }
}
