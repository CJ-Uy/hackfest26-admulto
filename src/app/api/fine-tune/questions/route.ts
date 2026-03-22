import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { polls, papers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateFineTuneQuestions } from "@/lib/ollama";

type FineTuneQuestion = { question: string; options: string[] };

function fallbackFineTuneQuestions(topic: string): FineTuneQuestion[] {
  const topicLabel = topic?.trim() || "this topic";
  return [
    {
      question: `For ${topicLabel}, what should we prioritize next?`,
      options: [
        "Foundational concepts",
        "Latest breakthroughs",
        "Practical applications",
        "Open problems",
      ],
    },
    {
      question: "What type of evidence do you prefer in posts?",
      options: [
        "Empirical/experimental results",
        "Systematic reviews",
        "Theoretical frameworks",
        "Mixed methods",
      ],
    },
    {
      question: "How technical should the feed be?",
      options: [
        "Beginner-friendly",
        "Balanced technical depth",
        "Advanced and specialized",
      ],
    },
    {
      question: "Which publication window matters most to you?",
      options: [
        "Last 2 years",
        "Last 5 years",
        "Seminal classics",
        "No preference",
      ],
    },
    {
      question: "What format is most helpful for your workflow?",
      options: [
        "Quick summary posts",
        "Methodology-focused takeaways",
        "Comparative analysis between papers",
        "Implementation-oriented insights",
      ],
    },
  ];
}

function normalizeQuestions(
  questions: FineTuneQuestion[],
  topic: string,
): FineTuneQuestion[] {
  const cleaned = questions
    .map((q) => ({
      question: q.question?.trim(),
      options: (q.options || []).map((o) => o.trim()).filter(Boolean),
    }))
    .filter((q) => q.question && q.options.length >= 2)
    .map((q) => ({
      question: q.question,
      options: Array.from(new Set(q.options)).slice(0, 4),
    }))
    .filter((q) => q.options.length >= 2)
    .slice(0, 5);

  if (cleaned.length >= 3) {
    return cleaned;
  }

  const fallback = fallbackFineTuneQuestions(topic);
  const merged = [...cleaned];
  for (const fq of fallback) {
    if (
      merged.some((q) => q.question.toLowerCase() === fq.question.toLowerCase())
    ) {
      continue;
    }
    merged.push(fq);
    if (merged.length >= 5) break;
  }
  return merged.slice(0, 5);
}

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

  const normalized = normalizeQuestions(questions, scroll?.title || "");

  if (normalized.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // Insert as polls with category "fine-tune"
  const inserted = await db
    .insert(polls)
    .values(
      normalized.map((q) => ({
        scrollId,
        type: "multiple-choice" as const,
        question: q.question,
        options: JSON.stringify(
          q.options.includes("Other") ? q.options : [...q.options, "Other"],
        ),
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
