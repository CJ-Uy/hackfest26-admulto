import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const votes = await db.vote.findMany({
    where: {
      paper: { scrollId },
    },
    select: {
      paperId: true,
      value: true,
    },
  });

  return NextResponse.json(votes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { paperId } = body as { paperId: string };

  if (!paperId) {
    return NextResponse.json(
      { error: "paperId required" },
      { status: 400 }
    );
  }

  // Toggle: if vote exists, remove it; otherwise create it
  const existing = await db.vote.findUnique({
    where: { paperId },
  });

  if (existing) {
    await db.vote.delete({ where: { id: existing.id } });
    return NextResponse.json({ voted: false, paperId });
  }

  await db.vote.create({
    data: { paperId, value: 1 },
  });

  return NextResponse.json({ voted: true, paperId });
}
