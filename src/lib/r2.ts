/**
 * R2 storage client for PDF uploads.
 *
 * In production (Cloudflare Workers): uses native R2Bucket binding.
 * In local dev: uses S3-compatible API with shared credentials from .env.
 */

async function getBucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext();
    return (ctx.env as { OBJECT_STORAGE?: R2Bucket }).OBJECT_STORAGE ?? null;
  } catch {
    return null;
  }
}

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 S3-compatible credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const BUCKET_NAME = "schrollar";

/**
 * Upload a PDF to R2 storage.
 * Returns the R2 object key.
 */
export async function uploadPdf(
  buffer: ArrayBuffer,
  filename: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `temp/${id}/${safeName}`;

  const bucket = await getBucket();
  if (bucket) {
    await bucket.put(key, buffer, {
      httpMetadata: { contentType: "application/pdf" },
    });
    return key;
  }

  // Fallback to S3-compatible API
  const s3 = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: "application/pdf",
    }),
  );
  return key;
}

/**
 * Retrieve a PDF from R2 storage.
 */
export async function getPdf(key: string): Promise<ArrayBuffer | null> {
  const bucket = await getBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return obj.arrayBuffer();
  }

  // Fallback to S3-compatible API
  const s3 = await getS3Client();
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return bytes.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

/**
 * Delete PDFs from R2 storage (cleanup after generation).
 */
export async function deletePdfs(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const bucket = await getBucket();
  if (bucket) {
    await Promise.all(keys.map((key) => bucket.delete(key)));
    return;
  }

  // Fallback to S3-compatible API
  const s3 = await getS3Client();
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await Promise.all(
    keys.map((key) =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })),
    ),
  );
}

// ─── Image storage ────────────────────────────────────────────────────────────

/**
 * Upload an image to R2 storage.
 * Key should be in the format: images/{scrollId}/{paperId}.png
 */
export async function uploadImage(
  buffer: ArrayBuffer,
  key: string,
  contentType: string,
): Promise<string> {
  const bucket = await getBucket();
  if (bucket) {
    await bucket.put(key, buffer, {
      httpMetadata: { contentType },
    });
    return key;
  }

  // Fallback to S3-compatible API
  const s3 = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Retrieve an image from R2 storage.
 */
export async function getImage(
  key: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const bucket = await getBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return {
      data: await obj.arrayBuffer(),
      contentType: obj.httpMetadata?.contentType || "image/png",
    };
  }

  // Fallback to S3-compatible API
  const s3 = await getS3Client();
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return {
      data: bytes.buffer as ArrayBuffer,
      contentType: res.ContentType || "image/png",
    };
  } catch {
    return null;
  }
}

/**
 * Delete images from R2 storage (cleanup).
 */
export async function deleteImages(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const bucket = await getBucket();
  if (bucket) {
    await Promise.all(keys.map((key) => bucket.delete(key)));
    return;
  }

  const s3 = await getS3Client();
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await Promise.all(
    keys.map((key) =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })),
    ),
  );
}
