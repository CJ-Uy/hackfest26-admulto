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
  const { paperId } = body as { paperId: string };

  if (!paperId) {
    return NextResponse.json({ error: "paperId required" }, { status: 400 });
  }

  // Toggle: if vote exists, remove it; otherwise create it
  const existing = await db.query.votes.findFirst({
    where: eq(votes.paperId, paperId),
  });

  if (existing) {
    await db.delete(votes).where(eq(votes.id, existing.id));
    return NextResponse.json({ voted: false, paperId });
  }

  await db.insert(votes).values({ paperId, value: 1 });

  return NextResponse.json({ voted: true, paperId });
}
