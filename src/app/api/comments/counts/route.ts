import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const result = await db
    .select({ id: papers.id, commentCount: papers.commentCount })
    .from(papers)
    .where(eq(papers.scrollId, scrollId));

  const counts: Record<string, number> = {};
  for (const p of result) {
    if (p.commentCount > 0) {
      counts[p.id] = p.commentCount;
    }
  }

  return NextResponse.json(counts);
}
