import { db } from "@/lib/db";
import type { Paper, ExportTheme } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scroll = await db.scroll.findUnique({
    where: { id },
    include: { papers: true },
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  const papers: Paper[] = scroll.papers.map((p) => ({
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
  }));

  let exportOutline: ExportTheme[] = [];
  if (scroll.exportData) {
    try {
      exportOutline = JSON.parse(scroll.exportData) as ExportTheme[];
    } catch {
      // ignore parse errors
    }
  }

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
  });
}
