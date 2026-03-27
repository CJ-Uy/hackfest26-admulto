export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { papers, scrolls } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const paper = await db.query.papers.findFirst({
    where: eq(papers.id, id),
    with: {
      votes: { columns: { id: true, value: true } },
      bookmarks: { columns: { id: true } },
    },
  });

  if (!paper) {
    return Response.json({ error: "Paper not found" }, { status: 404 });
  }

  // Lightweight list of sibling papers for comment author-matching
  const siblingPapers = await db.query.papers.findMany({
    where: eq(papers.scrollId, paper.scrollId),
    columns: { id: true, title: true, authors: true, doi: true, apaCitation: true },
  });

  const scrollPapers = siblingPapers.map((p) => ({
    id: p.id,
    title: p.title,
    authors: JSON.parse(p.authors) as string[],
    doi: p.doi,
    apaCitation: p.apaCitation,
  }));

  return Response.json({
    paper: {
      id: paper.id,
      title: paper.title,
      authors: JSON.parse(paper.authors) as string[],
      journal: paper.journal,
      year: paper.year,
      doi: paper.doi,
      peerReviewed: paper.peerReviewed,
      synthesis: paper.synthesis,
      credibilityScore: paper.credibilityScore,
      citationCount: paper.citationCount,
      commentCount: paper.commentCount,
      apaCitation: paper.apaCitation,
      voted: paper.votes.length > 0 && paper.votes[0].value === 1,
      downvoted: paper.votes.length > 0 && paper.votes[0].value === -1,
      bookmarked: paper.bookmarks.length > 0,
      groundingData: paper.groundingData
        ? JSON.parse(paper.groundingData)
        : null,
    },
    scrollId: paper.scrollId,
    scrollPapers,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const paper = await db.query.papers.findFirst({
    where: eq(papers.id, id),
  });

  if (!paper) {
    return Response.json({ error: "Paper not found" }, { status: 404 });
  }

  // Delete paper (cascade removes comments, votes, bookmarks)
  await db.delete(papers).where(eq(papers.id, id));

  // Decrement scroll paper count
  await db
    .update(scrolls)
    .set({ paperCount: sql`MAX(${scrolls.paperCount} - 1, 0)` })
    .where(eq(scrolls.id, paper.scrollId));

  return Response.json({ success: true });
}
