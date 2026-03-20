import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const papers = await db.paper.findMany({
    where: { scrollId },
    select: { id: true, commentCount: true },
  });

  const counts: Record<string, number> = {};
  for (const p of papers) {
    if (p.commentCount > 0) {
      counts[p.id] = p.commentCount;
    }
  }

  return NextResponse.json(counts);
}
