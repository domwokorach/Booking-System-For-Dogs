import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
const rawEnvSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(32).optional(),
    JWT_EXPIRES_IN: z.string().default("7d"),
    JWT_ACCESS_SECRET: z.string().min(32).optional(),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    FRONTEND_URL: z.string().url().default("http://localhost:5173"),
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().default(2525),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    EMAIL_FROM: z.string().email().default("noreply@pawside.local"),
    STORAGE_PROVIDER: z.enum(["s3", "gcs"]).default("s3"),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_S3_BUCKET: z.string().default(""),
    AWS_ACCESS_KEY_ID: z.string().default(""),
    AWS_SECRET_ACCESS_KEY: z.string().default(""),
    GCP_PROJECT_ID: z.string().default(""),
    GCP_BUCKET: z.string().default(""),
    GCP_KEY_FILE: z.string().default(""),
});
const rawEnv = rawEnvSchema.parse(process.env);
const jwtAccessSecret = rawEnv.JWT_ACCESS_SECRET ?? rawEnv.JWT_SECRET;
const jwtRefreshSecret = rawEnv.JWT_REFRESH_SECRET ?? rawEnv.JWT_SECRET;
if (!jwtAccessSecret || !jwtRefreshSecret) {
    throw new Error("Missing JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET or provide JWT_SECRET.");
}
export const env = {
    ...rawEnv,
    JWT_SECRET: rawEnv.JWT_SECRET ?? jwtAccessSecret,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
};
