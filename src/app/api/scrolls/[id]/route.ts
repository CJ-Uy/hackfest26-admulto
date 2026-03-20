import { db } from "@/lib/db";
import type { Paper, ExportTheme, Poll } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scroll = await db.scroll.findUnique({
    where: { id },
    include: {
      papers: {
        include: {
          votes: { select: { id: true } },
        },
      },
      polls: {
        include: {
          responses: { select: { answer: true } },
        },
      },
    },
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  const papers: (Paper & { voted: boolean })[] = scroll.papers.map((p) => ({
    id: p.id,
    title: p.title,
    authors: JSON.parse(p.authors) as string[],
    journal: p.journal,
    year: p.year,
    doi: p.doi,
    peerReviewed: p.peerReviewed,
    synthesis: p.synthesis,
    credibilityScore: p.credibilityScore,
    citationCount: p.citationCount,
    commentCount: p.commentCount,
    apaCitation: p.apaCitation,
    voted: p.votes.length > 0,
  }));

  let exportOutline: ExportTheme[] = [];
  if (scroll.exportData) {
    try {
      exportOutline = JSON.parse(scroll.exportData) as ExportTheme[];
    } catch {
      // ignore parse errors
    }
  }

  const polls: Poll[] = scroll.polls.map((p) => ({
    id: p.id,
    type: p.type as "multiple-choice" | "open-ended",
    question: p.question,
    options: p.options ? (JSON.parse(p.options) as string[]) : undefined,
    selectedAnswer: p.responses[0]?.answer ?? undefined,
  }));

  return Response.json({
    scroll: {
      id: scroll.id,
      title: scroll.title,
      description: scroll.description,
      date: scroll.date,
      paperCount: scroll.paperCount,
      mode: scroll.mode,
    },
    papers,
    exportOutline,
    polls,
  });
}
