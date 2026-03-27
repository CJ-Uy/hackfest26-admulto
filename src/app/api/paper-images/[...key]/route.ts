import { getImage } from "@/lib/r2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  if (!key.startsWith("images/")) {
    return new Response("Not found", { status: 404 });
  }

  const result = await getImage(key);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(result.data, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
