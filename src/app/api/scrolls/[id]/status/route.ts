import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, id),
    });

    if (!scroll) {
      return Response.json({ error: "Scroll not found" }, { status: 404 });
    }

    return Response.json({
      status: scroll.status,
      progress: scroll.progress ? JSON.parse(scroll.progress) : null,
    });
  } catch (err) {
    console.error("Status route error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
