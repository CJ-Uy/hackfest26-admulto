import { db } from "@/lib/db";
import { papers, comments } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { generateSocialComments } from "@/lib/ollama";

/**
 * POST /api/scrolls/[id]/generate-comments
 *
 * Picks a random paper in the scroll and generates 1-2 new discussion comments
 * from other papers' perspectives. Called periodically while the user is viewing
 * the scroll to simulate an active research discussion.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scrollId } = await params;

  // Accept optional paperId to target a specific paper
  let requestedPaperId: string | null = null;
  try {
    const body = (await req.json()) as { paperId?: string };
    requestedPaperId = body?.paperId || null;
  } catch {
    // No body or invalid JSON — that's fine, pick randomly
  }

  try {
    // Get all papers in this scroll
    const scrollPapers = await db
      .select()
      .from(papers)
      .where(eq(papers.scrollId, scrollId));

    if (scrollPapers.length < 2) {
      return Response.json({ generated: 0 });
    }

    // Pick target paper: use requested paperId or random
    let targetIdx: number;
    if (requestedPaperId) {
      const idx = scrollPapers.findIndex((p) => p.id === requestedPaperId);
      targetIdx =
        idx >= 0 ? idx : Math.floor(Math.random() * scrollPapers.length);
    } else {
      targetIdx = Math.floor(Math.random() * scrollPapers.length);
    }
    const target = scrollPapers[targetIdx];
    const targetAuthors = JSON.parse(target.authors) as string[];

    // Get other papers as potential commenters (exclude the target)
    const others = scrollPapers
      .filter((_, i) => i !== targetIdx)
      .map((p) => ({
        title: p.title,
        synthesis: p.synthesis,
        authors: JSON.parse(p.authors) as string[],
        year: p.year,
        citationCount: p.citationCount,
        doi: p.doi,
      }));

    // Shuffle and pick 3 commenters for variety
    const shuffled = others.sort(() => Math.random() - 0.5);
    const commentCount = 3;
    const commenters = shuffled.slice(0, commentCount);

    // Check existing comment count to avoid flooding
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.paperId, target.id));

    // Cap at ~20 generated comments per paper to avoid overwhelming the thread
    if (existingCount.count >= 20) {
      // Pick a different paper with fewer comments instead
      const paperWithFewest = scrollPapers
        .filter((p) => p.id !== target.id)
        .sort((a, b) => a.commentCount - b.commentCount)[0];

      if (!paperWithFewest || paperWithFewest.commentCount >= 20) {
        return Response.json({
          generated: 0,
          reason: "all papers have enough comments",
        });
      }

      // Recurse with the paper with fewest comments as target
      const fewestAuthors = JSON.parse(paperWithFewest.authors) as string[];
      const fewestOthers = scrollPapers
        .filter((p) => p.id !== paperWithFewest.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, commentCount)
        .map((p) => ({
          title: p.title,
          synthesis: p.synthesis,
          authors: JSON.parse(p.authors) as string[],
          year: p.year,
          citationCount: p.citationCount,
          doi: p.doi,
        }));

      const newComments = await generateSocialComments(
        {
          title: paperWithFewest.title,
          synthesis: paperWithFewest.synthesis,
          authors: fewestAuthors,
        },
        fewestOthers,
        commentCount,
      );

      if (newComments.length > 0) {
        await db.insert(comments).values(
          newComments.map((c) => ({
            paperId: paperWithFewest.id,
            content: c.content,
            author: c.author,
            isGenerated: true,
            relationship: c.relationship,
          })),
        );

        await db
          .update(papers)
          .set({
            commentCount: sql`${papers.commentCount} + ${newComments.length}`,
          })
          .where(eq(papers.id, paperWithFewest.id));
      }

      return Response.json({
        generated: newComments.length,
        paperId: paperWithFewest.id,
      });
    }

    // Generate comments
    const newComments = await generateSocialComments(
      {
        title: target.title,
        synthesis: target.synthesis,
        authors: targetAuthors,
      },
      commenters,
      commentCount,
    );

    if (newComments.length > 0) {
      await db.insert(comments).values(
        newComments.map((c) => ({
          paperId: target.id,
          content: c.content,
          author: c.author,
          isGenerated: true,
          relationship: c.relationship,
        })),
      );

      await db
        .update(papers)
        .set({
          commentCount: sql`${papers.commentCount} + ${newComments.length}`,
        })
        .where(eq(papers.id, target.id));
    }

    return Response.json({
      generated: newComments.length,
      paperId: target.id,
    });
  } catch (err) {
    console.error("Failed to generate background comments:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Comment generation failed",
      },
      { status: 500 },
    );
  }
}
