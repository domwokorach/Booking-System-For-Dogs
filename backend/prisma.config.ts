import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  // `prisma generate` runs during dependency installation and does not need a
  // database connection. Only require the production URL for commands that
  // actually access the database, such as migrations.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
