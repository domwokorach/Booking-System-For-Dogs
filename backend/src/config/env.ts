import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  CLIENT_ORIGIN: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  BUSINESS_TIME_ZONE: z.string().min(1).default("Europe/London"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(2525),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().min(1).default("Pawside <onboarding@resend.dev>"),
  BOOKING_EMAIL_TO: z
    .union([z.string().email(), z.literal("")])
    .default("dominic.olanya@gmail.com"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_CURRENCY: z.string().length(3).default("gbp"),
  WEATHER_API: z.string().default(""),
  WEATHER_LAT: z.coerce.number().min(-90).max(90).default(51.7356),
  WEATHER_LON: z.coerce.number().min(-180).max(180).default(0.4685),
  WEATHER_LOCATION: z.string().min(1).default("Essex, UK"),
  WEATHER_CACHE_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
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
  throw new Error(
    "Missing JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET or provide JWT_SECRET.",
  );
}

export const env = {
  ...rawEnv,
  CLIENT_ORIGIN: rawEnv.CLIENT_ORIGIN ?? rawEnv.FRONTEND_URL,
  JWT_SECRET: rawEnv.JWT_SECRET ?? jwtAccessSecret,
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
};
