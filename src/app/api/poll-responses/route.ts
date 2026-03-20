import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const pollId = req.nextUrl.searchParams.get("pollId");
  if (!pollId) {
    return NextResponse.json({ error: "pollId required" }, { status: 400 });
  }

  const response = await db.pollResponse.findUnique({
    where: { pollId },
  });

  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pollId, answer } = body as { pollId: string; answer: string };

  if (!pollId || !answer) {
    return NextResponse.json(
      { error: "pollId and answer required" },
      { status: 400 },
    );
  }

  // Upsert: update if already answered, create if not
  const response = await db.pollResponse.upsert({
    where: { pollId },
    update: { answer },
    create: { pollId, answer },
  });

  return NextResponse.json(response);
}
