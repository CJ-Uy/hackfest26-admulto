import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pollResponses } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const pollId = req.nextUrl.searchParams.get("pollId");
  if (!pollId) {
    return NextResponse.json({ error: "pollId required" }, { status: 400 });
  }

  const response = await db.query.pollResponses.findFirst({
    where: eq(pollResponses.pollId, pollId),
  });

  return NextResponse.json(response ?? null);
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
  const existing = await db.query.pollResponses.findFirst({
    where: eq(pollResponses.pollId, pollId),
  });

  if (existing) {
    const [updated] = await db
      .update(pollResponses)
      .set({ answer })
      .where(eq(pollResponses.id, existing.id))
      .returning();
    return NextResponse.json({ ...updated });
  }

  const [created] = await db
    .insert(pollResponses)
    .values({ pollId, answer })
    .returning();

  return NextResponse.json({ ...created });
}
