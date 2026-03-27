/**
 * R2 storage client.
 *
 * Production: native R2Bucket binding via getCloudflareContext().
 * Development: S3-compatible HTTP API (same pattern as db.ts fallback).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const isDev = process.env.NODE_ENV === "development";
const R2_BUCKET_NAME = "schrollar";

// --------------- Production: native R2 binding ---------------

async function getBucket(): Promise<R2Bucket> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const ctx = await getCloudflareContext();
  const bucket = (ctx.env as { OBJECT_STORAGE?: R2Bucket }).OBJECT_STORAGE;
  if (!bucket) {
    throw new Error(
      "R2 bucket binding 'OBJECT_STORAGE' not found. Ensure wrangler.jsonc has the R2 binding configured.",
    );
  }
  return bucket;
}

// --------------- Development: S3-compatible API ---------------

const globalForR2 = globalThis as unknown as { s3Client?: S3Client };

function getS3Client(): S3Client {
  if (!globalForR2.s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 binding unavailable and R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars not set",
      );
    }
    globalForR2.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return globalForR2.s3Client;
}

// --------------- Exported functions ---------------

export async function uploadPdf(
  buffer: ArrayBuffer,
  filename: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `temp/${id}/${safeName}`;

  if (isDev) {
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: "application/pdf",
      }),
    );
    return key;
  }
  const bucket = await getBucket();
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: "application/pdf" },
  });
  return key;
}

export async function getPdf(key: string): Promise<ArrayBuffer | null> {
  if (isDev) {
    const s3 = getS3Client();
    try {
      const resp = await s3.send(
        new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      );
      const bytes = await resp.Body!.transformToByteArray();
      return bytes.buffer as ArrayBuffer;
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  const bucket = await getBucket();
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.arrayBuffer();
}

export async function deletePdfs(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (isDev) {
    const s3 = getS3Client();
    await Promise.all(
      keys.map((key) =>
        s3.send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
        ),
      ),
    );
    return;
  }
  const bucket = await getBucket();
  await Promise.all(keys.map((key) => bucket.delete(key)));
}

/**
 * Upload an image to R2 storage.
 * @param key  Full R2 object key, e.g. "images/{scrollId}/{paperId}.png"
 */
export async function uploadImage(
  buffer: ArrayBuffer,
  key: string,
  contentType = "image/png",
): Promise<void> {
  if (isDev) {
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
      }),
    );
    return;
  }
  const bucket = await getBucket();
  await bucket.put(key, buffer, {
    httpMetadata: { contentType },
  });
}

export async function getImage(key: string): Promise<ArrayBuffer | null> {
  if (isDev) {
    const s3 = getS3Client();
    try {
      const resp = await s3.send(
        new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      );
      const bytes = await resp.Body!.transformToByteArray();
      return bytes.buffer as ArrayBuffer;
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  const bucket = await getBucket();
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.arrayBuffer();
}

export async function deleteImages(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (isDev) {
    const s3 = getS3Client();
    await Promise.all(
      keys.map((key) =>
        s3.send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
        ),
      ),
    );
    return;
  }
  const bucket = await getBucket();
  await Promise.all(keys.map((key) => bucket.delete(key)));
}
