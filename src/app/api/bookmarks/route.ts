export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookmarks, papers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const result = await db
    .select({ paperId: bookmarks.paperId })
    .from(bookmarks)
    .innerJoin(papers, eq(bookmarks.paperId, papers.id))
    .where(eq(papers.scrollId, scrollId));

  return NextResponse.json(result.map((r) => r.paperId));
}

export async function POST(req: NextRequest) {
  const { paperId } = (await req.json()) as { paperId: string };

  if (!paperId) {
    return NextResponse.json({ error: "paperId required" }, { status: 400 });
  }

  // Toggle: if exists, remove; otherwise add
  const existing = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.paperId, paperId));

  if (existing.length > 0) {
    await db.delete(bookmarks).where(eq(bookmarks.paperId, paperId));
    return NextResponse.json({ bookmarked: false, paperId });
  }

  await db.insert(bookmarks).values({ paperId });
  return NextResponse.json({ bookmarked: true, paperId });
}
