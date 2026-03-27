import { getImage } from "@/lib/r2";

/** Detect image MIME type from magic bytes. */
function detectMime(buffer: ArrayBuffer): string {
  const b = new Uint8Array(buffer.slice(0, 4));
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const r2Key = key.join("/");

  try {
    const buffer = await getImage(r2Key);

    if (!buffer) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": detectMime(buffer),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[paper-images] Failed to retrieve image:", r2Key, err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
