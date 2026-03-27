/**
 * R2 storage client for PDF uploads.
 *
 * Uses native R2Bucket binding via Cloudflare Workers.
 * For local dev, use `wrangler dev` to get R2 bindings.
 */

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
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: "application/pdf" },
  });
  return key;
}

/**
 * Retrieve a PDF from R2 storage.
 */
export async function getPdf(key: string): Promise<ArrayBuffer | null> {
  const bucket = await getBucket();
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.arrayBuffer();
}

/**
 * Delete PDFs from R2 storage (cleanup after generation).
 */
export async function deletePdfs(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const bucket = await getBucket();
  await Promise.all(keys.map((key) => bucket.delete(key)));
}
