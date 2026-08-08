import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
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

export const env = envSchema.parse(process.env);
