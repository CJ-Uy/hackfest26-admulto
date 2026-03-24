import { db } from "@/lib/db";
import { scrolls, papers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

/** How long a scroll can stay "generating" before we auto-recover it (5 min). */
const STALE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Simple polling endpoint — client calls this repeatedly instead of
 * holding a long-lived SSE connection (which hits CF Workers CPU limits).
 *
 * Also handles stale scroll recovery: if a scroll has been "generating"
 * for over 5 minutes but already has papers saved, mark it complete so
 * the user isn't stuck on an infinite loading screen.
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

    // Auto-recover stale "generating" scrolls that already have papers
    if (scroll.status === "generating" && scroll.createdAt) {
      const createdMs = new Date(scroll.createdAt + "Z").getTime();
      const ageMs = Date.now() - createdMs;

      if (ageMs > STALE_TIMEOUT_MS) {
        // Check if any papers were saved incrementally
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(papers)
          .where(eq(papers.scrollId, id));

        if (count > 0) {
          console.log(
            `[stream] Auto-recovering stale scroll ${id}: ${count} papers saved, age ${Math.round(ageMs / 1000)}s`,
          );
          await db
            .update(scrolls)
            .set({
              status: "complete",
              progress: null,
              paperCount: count,
            })
            .where(eq(scrolls.id, id));

          return Response.json({ status: "complete", progress: null });
        }
      }
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
