import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, and, gt, desc } from "drizzle-orm";

/**
 * Simple polling endpoint for new comments — client passes ?since= timestamp
 * and gets back any comments newer than that.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scrollId } = await params;
  const url = new URL(req.url);
  const since =
    url.searchParams.get("since") ||
    new Date().toISOString().replace("T", " ").replace("Z", "");

  try {
    const newComments = await db
      .select({
        id: comments.id,
        paperId: comments.paperId,
        userPostId: comments.userPostId,
        parentId: comments.parentId,
        content: comments.content,
        author: comments.author,
        isGenerated: comments.isGenerated,
        relationship: comments.relationship,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(papers, eq(comments.paperId, papers.id))
      .where(
        and(eq(papers.scrollId, scrollId), gt(comments.createdAt, since)),
      )
      .orderBy(desc(comments.createdAt));

    return Response.json({
      comments: newComments.map((c) => ({
        ...c,
        isGenerated: c.isGenerated ?? false,
        relationship: c.relationship ?? null,
        parentId: c.parentId ?? null,
      })),
    });
  } catch (err) {
    console.error("Comment poll error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Poll error" },
      { status: 500 },
    );
  }
}
