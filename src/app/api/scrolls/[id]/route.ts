import { db } from "@/lib/db";
import {
  scrolls,
  papers,
  votes,
  polls,
  pollResponses,
  bookmarks,
  userPosts,
} from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import type { Paper, ExportTheme, Poll, UserPost } from "@/lib/types";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const scroll = await db.query.scrolls.findFirst({
    where: eq(scrolls.id, id),
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  await db.delete(scrolls).where(eq(scrolls.id, id));

  return Response.json({ success: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const scroll = await db.query.scrolls.findFirst({
    where: eq(scrolls.id, id),
    with: {
      papers: {
        with: {
          votes: {
            columns: { id: true },
          },
          bookmarks: {
            columns: { id: true },
          },
        },
      },
      userPosts: true,
      polls: {
        with: {
          responses: {
            columns: { answer: true },
          },
        },
      },
    },
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  const responsePapers: (Paper & { voted: boolean; bookmarked: boolean })[] =
    scroll.papers.map((p) => ({
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
      bookmarked: p.bookmarks.length > 0,
    }));

  const responseUserPosts: UserPost[] = (scroll.userPosts || []).map((up) => ({
    id: up.id,
    content: up.content,
    title: up.title ?? undefined,
    commentCount: up.commentCount,
    createdAt: up.createdAt,
  }));

  let exportOutline: ExportTheme[] = [];
  if (scroll.exportData) {
    try {
      exportOutline = JSON.parse(scroll.exportData) as ExportTheme[];
    } catch {
      // ignore parse errors
    }
  }

  const responsePolls: Poll[] = scroll.polls.map((p) => ({
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
      status: scroll.status,
    },
    papers: responsePapers,
    exportOutline,
    polls: responsePolls,
    userPosts: responseUserPosts,
  });
}
