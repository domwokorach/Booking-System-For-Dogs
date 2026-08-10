import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

type GcsFileHandle = {
  save(buffer: Buffer, options: Record<string, unknown>): Promise<void>;
  getSignedUrl(options: Record<string, unknown>): Promise<[string]>;
};

type GcsBucketHandle = {
  file(key: string): GcsFileHandle;
};

type GcsStorageHandle = {
  bucket(name: string): GcsBucketHandle;
};

let gcsStoragePromise: Promise<GcsStorageHandle> | null = null;

async function getGcsStorage(): Promise<GcsStorageHandle> {
  if (!gcsStoragePromise) {
    gcsStoragePromise = (async () => {
      const dynamicImport = new Function(
        'return import("@google-cloud/storage")',
      ) as () => Promise<{ Storage: new (options?: Record<string, unknown>) => GcsStorageHandle }>;

      const { Storage } = await dynamicImport();
      return env.GCP_PROJECT_ID && env.GCP_KEY_FILE
        ? new Storage({
            projectId: env.GCP_PROJECT_ID,
            keyFilename: env.GCP_KEY_FILE,
          })
        : new Storage();
    })();
  }

  return gcsStoragePromise;
}

type UploadResult = {
  provider: "s3" | "gcs";
  key: string;
  url: string;
};

function buildObjectKey(filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  return `uploads/${Date.now()}-${randomUUID()}${ext}`;
}

async function writeToLocalFallback(key: string, buffer: Buffer) {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Cloud storage credentials are required in production; local uploads are not durable.",
    );
  }

  const uploadDir = join(process.cwd(), "uploads");
  const outputPath = join(uploadDir, key);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

export async function uploadFileToCloud(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<UploadResult> {
  const key = buildObjectKey(input.filename);

  if (env.STORAGE_PROVIDER === "s3") {
    if (!env.AWS_S3_BUCKET || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      await writeToLocalFallback(key, input.buffer);

      return {
        provider: "s3",
        key,
        url: `/uploads/${key}`,
      };
    }

    const put = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType,
    });

    await s3Client.send(put);

    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      }),
      { expiresIn: 3600 },
    );

    return {
      provider: "s3",
      key,
      url: signedUrl,
    };
  }

  if (!env.GCP_BUCKET) {
    await writeToLocalFallback(key, input.buffer);

    return {
      provider: "gcs",
      key,
      url: `/uploads/${key}`,
    };
  }

  const gcsStorage = await getGcsStorage();
  const bucket = gcsStorage.bucket(env.GCP_BUCKET);
  const file = bucket.file(key);

  await file.save(input.buffer, {
    contentType: input.mimeType,
    resumable: false,
    metadata: {
      contentType: input.mimeType,
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });

  return {
    provider: "gcs",
    key,
    url: signedUrl,
  };
}
