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
    return (ctx.env as { PDF_BUCKET?: R2Bucket }).PDF_BUCKET ?? null;
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

const BUCKET_NAME = "schrollar-pdfs";

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
