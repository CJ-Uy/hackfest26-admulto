import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { polls, papers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateExportPromptQuestions } from "@/lib/ollama";

type ExportPromptQuestion = { question: string; options: string[] };

function fallbackExportPromptQuestions(topic: string): ExportPromptQuestion[] {
  const topicLabel = topic?.trim() || "this topic";
  return [
    {
      question: `What is the primary purpose of this research prompt about ${topicLabel}?`,
      options: [
        "Writing a literature review",
        "Exploring a new research direction",
        "Preparing a grant proposal",
        "General knowledge building",
      ],
    },
    {
      question: "What research methodology are you most interested in?",
      options: [
        "Empirical/experimental studies",
        "Systematic reviews & meta-analyses",
        "Theoretical/conceptual frameworks",
        "Mixed methods",
      ],
    },
    {
      question: "What scope should the prompt cover?",
      options: [
        "Narrow and deep (specific sub-topic)",
        "Broad survey of the field",
        "Comparative analysis across approaches",
        "Gaps and future directions",
      ],
    },
    {
      question: "What kind of output do you want from the AI?",
      options: [
        "Structured outline with sections",
        "Annotated bibliography",
        "Research questions and hypotheses",
        "Methodology recommendations",
      ],
    },
  ];
}

function normalizeQuestions(
  questions: ExportPromptQuestion[],
  topic: string,
): ExportPromptQuestion[] {
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
    .slice(0, 4);

  if (cleaned.length >= 3) {
    return cleaned;
  }

  const fallback = fallbackExportPromptQuestions(topic);
  const merged = [...cleaned];
  for (const fq of fallback) {
    if (
      merged.some((q) => q.question.toLowerCase() === fq.question.toLowerCase())
    ) {
      continue;
    }
    merged.push(fq);
    if (merged.length >= 4) break;
  }
  return merged.slice(0, 4);
}

export async function GET(req: NextRequest) {
  const scrollId = req.nextUrl.searchParams.get("scrollId");
  if (!scrollId) {
    return NextResponse.json({ error: "scrollId required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(polls)
    .where(
      and(eq(polls.scrollId, scrollId), eq(polls.category, "export-prompt")),
    );

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

  // Check if export-prompt questions already exist
  const existing = await db
    .select()
    .from(polls)
    .where(
      and(eq(polls.scrollId, scrollId), eq(polls.category, "export-prompt")),
    );

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

  const questions = await generateExportPromptQuestions(
    scrollPapers,
    scroll?.title || "",
  );

  const normalized = normalizeQuestions(questions, scroll?.title || "");

  if (normalized.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // Insert as polls with category "export-prompt"
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
        category: "export-prompt",
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
