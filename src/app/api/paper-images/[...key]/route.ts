import { getImage } from "@/lib/r2";
import { detectImageMime } from "@/lib/image-fill";

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

    const contentType = detectImageMime(buffer);

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[paper-images] Failed to retrieve image:", r2Key, err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
