import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * Simple polling endpoint — client calls this repeatedly instead of
 * holding a long-lived SSE connection (which hits CF Workers CPU limits).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, id),
    });

    if (!scroll) {
      return Response.json({ error: "Schroll not found" }, { status: 404 });
    }

    const progress = scroll.progress ? JSON.parse(scroll.progress) : null;

    return Response.json({
      status: scroll.status,
      progress,
    });
  } catch (err) {
    console.error("Stream poll error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Poll error" },
      { status: 500 },
    );
  }
}
