export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { votes, papers } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const rows = await db
    .select({ paperId: votes.paperId, value: votes.value })
    .from(votes)
    .innerJoin(papers, eq(votes.paperId, papers.id))
    .where(eq(papers.scrollId, scrollId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { paperId, value } = body as { paperId: string; value?: number };

  if (!paperId) {
    return NextResponse.json({ error: "paperId required" }, { status: 400 });
  }

  const voteValue = value === -1 ? -1 : 1;

  // Toggle: if vote exists with same value, remove it; otherwise upsert
  const existing = await db.query.votes.findFirst({
    where: eq(votes.paperId, paperId),
  });

  if (existing) {
    if (existing.value === voteValue) {
      // Same vote again → toggle off
      await db.delete(votes).where(eq(votes.id, existing.id));
      return NextResponse.json({ voted: false, value: 0, paperId });
    }
    // Different vote → update
    await db
      .update(votes)
      .set({ value: voteValue })
      .where(eq(votes.id, existing.id));
    return NextResponse.json({ voted: true, value: voteValue, paperId });
  }

  await db.insert(votes).values({ paperId, value: voteValue });

  return NextResponse.json({ voted: true, value: voteValue, paperId });
}
