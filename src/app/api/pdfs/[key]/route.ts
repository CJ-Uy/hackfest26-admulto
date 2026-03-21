import { getPdf } from "@/lib/r2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    const buffer = await getPdf(decodedKey);
    if (!buffer) {
      return Response.json({ error: "PDF not found" }, { status: 404 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${decodedKey.split("/").pop() || "document.pdf"}"`,
      },
    });
  } catch {
    return Response.json({ error: "Failed to retrieve PDF" }, { status: 500 });
  }
}
