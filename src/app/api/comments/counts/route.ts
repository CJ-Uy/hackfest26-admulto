import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, and, sql, isNull, isNotNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  const onlyMine = req.nextUrl.searchParams.get("onlyMine") === "true";
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  // Count comments on papers (excluding user-post comments).
  const paperCounts = await db
    .select({
      paperId: comments.paperId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(comments)
    .innerJoin(papers, eq(comments.paperId, papers.id))
    .where(
      and(
        eq(papers.scrollId, scrollId),
        isNull(comments.userPostId),
        ...(onlyMine
          ? [eq(comments.isGenerated, false), eq(comments.author, "You")]
          : []),
      ),
    )
    .groupBy(comments.paperId);

  // Count comments on user posts.
  const postCounts = await db
    .select({
      userPostId: comments.userPostId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(comments)
    .where(
      and(
        isNotNull(comments.userPostId),
        ...(onlyMine
          ? [eq(comments.isGenerated, false), eq(comments.author, "You")]
          : []),
      ),
    )
    .groupBy(comments.userPostId);

  const counts: Record<string, number> = {};
  for (const r of paperCounts) {
    counts[r.paperId] = r.count;
  }
  for (const r of postCounts) {
    if (r.userPostId) {
      counts[`post:${r.userPostId}`] = r.count;
    }
  }

  return NextResponse.json(counts);
}
