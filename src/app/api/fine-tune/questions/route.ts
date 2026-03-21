import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { polls, papers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateFineTuneQuestions } from "@/lib/ollama";

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  // Return existing fine-tune questions
  const existing = await db
    .select()
    .from(polls)
    .where(and(eq(polls.scrollId, scrollId), eq(polls.category, "fine-tune")));

  return NextResponse.json(
    existing.map((p) => ({
      id: p.id,
      question: p.question,
      options: p.options ? JSON.parse(p.options) : [],
      type: p.type,
    })),
  );
}

export async function POST(req: NextRequest) {
  const { scrollId } = (await req.json()) as { scrollId: string };

  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  // Check if fine-tune questions already exist
  const existing = await db
    .select()
    .from(polls)
    .where(and(eq(polls.scrollId, scrollId), eq(polls.category, "fine-tune")));

  if (existing.length > 0) {
    return NextResponse.json(
      existing.map((p) => ({
        id: p.id,
        question: p.question,
        options: p.options ? JSON.parse(p.options) : [],
        type: p.type,
      })),
    );
  }

  // Get papers for context
  const scrollPapers = await db
    .select({ title: papers.title, synthesis: papers.synthesis })
    .from(papers)
    .where(eq(papers.scrollId, scrollId));

  // Get scroll topic
  const scroll = await db.query.scrolls.findFirst({
    where: (s, { eq }) => eq(s.id, scrollId),
  });

  const questions = await generateFineTuneQuestions(
    scrollPapers,
    scroll?.title || "",
  );

  if (questions.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // Insert as polls with category "fine-tune"
  const inserted = await db
    .insert(polls)
    .values(
      questions.map((q) => ({
        scrollId,
        type: "multiple-choice" as const,
        question: q.question,
        options: JSON.stringify([...q.options, "Other"]),
        category: "fine-tune",
      })),
    )
    .returning();

  return NextResponse.json(
    inserted.map((p) => ({
      id: p.id,
      question: p.question,
      options: p.options ? JSON.parse(p.options) : [],
      type: p.type,
    })),
    { status: 201 },
  );
}
