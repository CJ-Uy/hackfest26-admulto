import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, and, sql, isNull, isNotNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  // Count all comments on papers (both user and AI-generated, excluding user-post comments)
  const paperCounts = await db
    .select({
      paperId: comments.paperId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(comments)
    .innerJoin(papers, eq(comments.paperId, papers.id))
    .where(and(eq(papers.scrollId, scrollId), isNull(comments.userPostId)))
    .groupBy(comments.paperId);

  // Count all comments on user posts
  const postCounts = await db
    .select({
      userPostId: comments.userPostId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(comments)
    .where(isNotNull(comments.userPostId))
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
