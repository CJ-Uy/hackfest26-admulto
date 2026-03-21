import { db } from "@/lib/db";
import { papers, scrolls } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const paper = await db.query.papers.findFirst({
    where: eq(papers.id, id),
  });

  if (!paper) {
    return Response.json({ error: "Paper not found" }, { status: 404 });
  }

  // Delete paper (cascade removes comments, votes, bookmarks)
  await db.delete(papers).where(eq(papers.id, id));

  // Decrement scroll paper count
  await db
    .update(scrolls)
    .set({ paperCount: sql`MAX(${scrolls.paperCount} - 1, 0)` })
    .where(eq(scrolls.id, paper.scrollId));

  return Response.json({ success: true });
}
