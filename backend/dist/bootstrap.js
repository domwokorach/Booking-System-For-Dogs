import { join } from "node:path";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js";
import { env } from "./config/env.js";
export function configureNestApplication(app, options = {}) {
    app.useBodyParser("json", { limit: "1mb" });
    app.useStaticAssets(join(process.cwd(), "uploads"), {
        prefix: "/uploads/",
    });
    app.enableCors({
        origin: env.CLIENT_ORIGIN,
        credentials: true,
    });
    app.useGlobalFilters(new ApiExceptionFilter());
    if (options.enableShutdownHooks ?? true) {
        app.enableShutdownHooks();
    }
}
