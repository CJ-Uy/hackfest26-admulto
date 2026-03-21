import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comments, papers } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  // Only count user comments (isGenerated = false) for the sidebar
  const result = await db
    .select({
      paperId: comments.paperId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(comments)
    .innerJoin(papers, eq(comments.paperId, papers.id))
    .where(
      and(eq(papers.scrollId, scrollId), eq(comments.isGenerated, false)),
    )
    .groupBy(comments.paperId);

  const counts: Record<string, number> = {};
  for (const r of result) {
    counts[r.paperId] = r.count;
  }

  return NextResponse.json(counts);
}
