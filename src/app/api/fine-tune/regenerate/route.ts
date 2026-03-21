import { after } from "next/server";
import { db } from "@/lib/db";
import {
  scrolls,
  papers,
  comments,
  votes,
  bookmarks,
  polls,
  pollResponses,
} from "@/lib/schema";
import { eq, and, sql, inArray, notInArray } from "drizzle-orm";
import { searchPapers } from "@/lib/paper-search";
import { webSearch } from "@/lib/search";
import {
  processAcademicPaper,
  processInBatches,
  processWebResult,
  generateCommentsForPapers,
} from "@/lib/paper-processing";
import {
  gatherInteractionContext,
  buildRefinedQuery,
} from "@/lib/interaction-context";

const CONCURRENCY = 2;

async function updateProgress(
  scrollId: string,
  step: string,
  extra: Record<string, number> = {},
) {
  await db
    .update(scrolls)
    .set({ progress: JSON.stringify({ step, ...extra }) })
    .where(eq(scrolls.id, scrollId));
}

export async function POST(req: Request) {
  const { scrollId } = (await req.json()) as { scrollId: string };

  if (!scrollId) {
    return Response.json({ error: "scrollId required" }, { status: 400 });
  }

  // Mark as regenerating
  await db
    .update(scrolls)
    .set({
      status: "generating",
      progress: JSON.stringify({ step: "searching" }),
    })
    .where(eq(scrolls.id, scrollId));

  after(async () => {
    try {
      // 1. Identify protected papers (upvoted, bookmarked, or user-commented)
      const upvotedIds = (
        await db
          .select({ paperId: votes.paperId })
          .from(votes)
          .innerJoin(papers, eq(votes.paperId, papers.id))
          .where(eq(papers.scrollId, scrollId))
      ).map((r) => r.paperId);

      const bookmarkedIds = (
        await db
          .select({ paperId: bookmarks.paperId })
          .from(bookmarks)
          .innerJoin(papers, eq(bookmarks.paperId, papers.id))
          .where(eq(papers.scrollId, scrollId))
      ).map((r) => r.paperId);

      const commentedIds = (
        await db
          .select({ paperId: comments.paperId })
          .from(comments)
          .innerJoin(papers, eq(comments.paperId, papers.id))
          .where(
            and(
              eq(papers.scrollId, scrollId),
              eq(comments.isGenerated, false),
            ),
          )
      ).map((r) => r.paperId);

      const protectedIds = [
        ...new Set([...upvotedIds, ...bookmarkedIds, ...commentedIds]),
      ];

      // 2. Delete unprotected papers and their comments
      const allPaperIds = (
        await db
          .select({ id: papers.id })
          .from(papers)
          .where(eq(papers.scrollId, scrollId))
      ).map((r) => r.id);

      const unprotectedIds = allPaperIds.filter(
        (id) => !protectedIds.includes(id),
      );

      if (unprotectedIds.length > 0) {
        // Delete comments for unprotected papers
        await db
          .delete(comments)
          .where(inArray(comments.paperId, unprotectedIds));
        // Delete unprotected papers
        await db.delete(papers).where(inArray(papers.id, unprotectedIds));
      }

      // 3. Gather context & build refined query
      const ctx = await gatherInteractionContext(scrollId);

      // Include fine-tune responses
      const fineTuneResponses = await db
        .select({
          question: polls.question,
          answer: pollResponses.answer,
        })
        .from(pollResponses)
        .innerJoin(polls, eq(pollResponses.pollId, polls.id))
        .where(
          and(
            eq(polls.scrollId, scrollId),
            eq(polls.category, "fine-tune"),
          ),
        );

      // Enrich the search query with fine-tune answers
      let searchQuery = buildRefinedQuery(ctx);
      for (const ft of fineTuneResponses.slice(0, 3)) {
        if (ft.answer && ft.answer.length > 3 && ft.answer !== "Other") {
          searchQuery += " " + ft.answer;
        }
      }

      const total = 8;
      await updateProgress(scrollId, "processing", {
        papersProcessed: 0,
        total,
      });

      // 4. Search for new papers
      const [academicPapers, webResults] = await Promise.all([
        searchPapers(searchQuery, 15),
        webSearch(searchQuery, 6).catch(
          () => [] as { title: string; url: string; snippet: string; engine: string }[],
        ),
      ]);

      // Filter out existing papers
      const newAcademic = academicPapers.filter(
        (p) => !ctx.existingTitles.has(p.title.toLowerCase()),
      );

      // 5. Process new papers
      let papersProcessed = 0;
      const processedPapers = [];

      for (
        let i = 0;
        i < newAcademic.length && processedPapers.length < total;
        i += CONCURRENCY
      ) {
        const batch = newAcademic.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map((raw) =>
            processAcademicPaper({
              id: raw.id,
              title: raw.title,
              abstract: raw.abstract,
              authors: raw.authors,
              year: raw.year,
              venue: raw.venue,
              doi: raw.doi,
              citationCount: raw.citationCount,
            }),
          ),
        );
        for (const r of batchResults) {
          if (processedPapers.length >= total) break;
          if (r.status === "fulfilled" && r.value !== null) {
            processedPapers.push(r.value);
          }
        }
        papersProcessed = Math.min(i + CONCURRENCY, newAcademic.length);
        await updateProgress(scrollId, "processing", {
          papersProcessed: Math.min(papersProcessed, total),
          total,
        });
      }

      // Supplement with web
      if (processedPapers.length < 4) {
        const eligibleWeb = webResults.filter(
          (r) =>
            r.snippet?.length >= 20 &&
            !ctx.existingTitles.has(r.title.toLowerCase()),
        );
        const remaining = total - processedPapers.length;
        const webPapers = await processInBatches(
          eligibleWeb,
          processWebResult,
          remaining,
        );
        processedPapers.push(...webPapers);
      }

      await updateProgress(scrollId, "exporting");

      // 6. Generate comments
      const paperComments = await generateCommentsForPapers(processedPapers);

      // 7. Persist
      if (processedPapers.length > 0) {
        const insertedPapers = await db
          .insert(papers)
          .values(
            processedPapers.map((p, idx) => ({
              scrollId,
              externalId: p.id,
              title: p.title,
              authors: JSON.stringify(p.authors),
              journal: p.journal,
              year: p.year,
              doi: p.doi,
              peerReviewed: p.peerReviewed,
              synthesis: p.synthesis,
              credibilityScore: p.credibilityScore,
              citationCount: p.citationCount,
              commentCount: (paperComments.get(idx) || []).length,
              apaCitation: p.apaCitation,
            })),
          )
          .returning();

        const allComments: {
          paperId: string;
          content: string;
          author: string;
          isGenerated: boolean;
          relationship: string;
        }[] = [];

        processedPapers.forEach((_, idx) => {
          const rawComments = paperComments.get(idx) || [];
          const dbPaper = insertedPapers[idx];
          if (dbPaper && rawComments.length > 0) {
            for (const c of rawComments) {
              allComments.push({
                paperId: dbPaper.id,
                content: c.content,
                author: c.author,
                isGenerated: true,
                relationship: c.relationship,
              });
            }
          }
        });

        if (allComments.length > 0) {
          await db.insert(comments).values(allComments);
        }
      }

      // Update paper count
      const finalCount = await db
        .select({ id: papers.id })
        .from(papers)
        .where(eq(papers.scrollId, scrollId));

      await db
        .update(scrolls)
        .set({
          paperCount: finalCount.length,
          status: "complete",
          progress: null,
        })
        .where(eq(scrolls.id, scrollId));

      console.log(
        `[fine-tune] Regeneration complete for ${scrollId}: kept ${protectedIds.length}, added ${processedPapers.length}`,
      );
    } catch (err) {
      console.error(`[fine-tune] Failed for ${scrollId}:`, err);
      await db
        .update(scrolls)
        .set({ status: "complete", progress: null })
        .where(eq(scrolls.id, scrollId));
    }
  });

  return Response.json({ regenerating: true });
}
