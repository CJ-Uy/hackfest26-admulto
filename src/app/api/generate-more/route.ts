import { after } from "next/server";
import { db } from "@/lib/db";
import { scrolls, papers, comments } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
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
import {
  safeEmbed,
  safeEmbedBatch,
  rankBySimilarity,
  cosineSimilarity,
} from "@/lib/embeddings";

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

  // Mark as generating more
  await db
    .update(scrolls)
    .set({
      status: "generating",
      progress: JSON.stringify({ step: "searching" }),
    })
    .where(eq(scrolls.id, scrollId));

  after(async () => {
    try {
      // 1. Gather interaction context
      const ctx = await gatherInteractionContext(scrollId);
      const searchQuery = buildRefinedQuery(ctx);

      console.log(
        `[generate-more] Refined query: "${searchQuery}" for scroll ${scrollId}`,
      );

      // 2. Search for new papers
      const [academicPapers, webResults] = await Promise.all([
        searchPapers(searchQuery, 15),
        webSearch(searchQuery, 6).catch(
          () =>
            [] as {
              title: string;
              url: string;
              snippet: string;
              engine: string;
            }[],
        ),
      ]);

      // Filter out papers already in the scroll (title match)
      let newAcademic = academicPapers.filter(
        (p) => !ctx.existingTitles.has(p.title.toLowerCase()),
      );

      // Load existing paper embeddings to filter semantic duplicates
      const existingPaperRows = await db
        .select({ embedding: papers.embedding })
        .from(papers)
        .where(eq(papers.scrollId, scrollId));
      const existingEmbeddings = existingPaperRows
        .map((r) =>
          r.embedding ? (JSON.parse(r.embedding) as number[]) : null,
        )
        .filter((e): e is number[] => !!e);

      // Embed new candidates that don't already have embeddings
      const needsEmb = newAcademic.filter((p) => !p.embedding);
      if (needsEmb.length > 0) {
        const texts = needsEmb.map(
          (p) => `${p.title}. ${p.abstract.slice(0, 500)}`,
        );
        const embs = await safeEmbedBatch(texts);
        if (embs) {
          needsEmb.forEach((p, i) => {
            p.embedding = embs[i];
          });
        }
      }

      // Remove papers too similar to existing ones (semantic dedup)
      if (existingEmbeddings.length > 0) {
        newAcademic = newAcademic.filter((p) => {
          if (!p.embedding) return true; // can't check, keep it
          const maxSim = Math.max(
            ...existingEmbeddings.map((e) => cosineSimilarity(p.embedding!, e)),
          );
          return maxSim < 0.92;
        });
      }

      // Rank by query relevance using stored or fresh query embedding
      const scroll = await db
        .select({ queryEmbedding: scrolls.queryEmbedding })
        .from(scrolls)
        .where(eq(scrolls.id, scrollId))
        .then((r) => r[0]);
      const queryEmbedding = scroll?.queryEmbedding
        ? (JSON.parse(scroll.queryEmbedding) as number[])
        : await safeEmbed(searchQuery);

      if (queryEmbedding) {
        const withEmb = newAcademic.filter((p) => p.embedding);
        const withoutEmb = newAcademic.filter((p) => !p.embedding);
        if (withEmb.length > 0) {
          const ranked = rankBySimilarity(
            queryEmbedding,
            withEmb.map((p) => p.embedding!),
          );
          newAcademic = [...ranked.map((r) => withEmb[r.index]), ...withoutEmb];
        }
      }

      const total = Math.min(newAcademic.length, 8);
      await updateProgress(scrollId, "processing", {
        papersProcessed: 0,
        total,
      });

      // 3. Process new papers
      let papersProcessed = 0;
      const processedPapers = [];

      for (
        let i = 0;
        i < newAcademic.length && processedPapers.length < 8;
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
              embedding: raw.embedding,
            }),
          ),
        );
        for (const r of batchResults) {
          if (processedPapers.length >= 8) break;
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

      // 4. Supplement with web results to fill remaining slots
      if (processedPapers.length < 8) {
        const eligibleWeb = webResults.filter(
          (r) =>
            r.snippet &&
            r.snippet.length >= 20 &&
            !ctx.existingTitles.has(r.title.toLowerCase()),
        );
        const remaining = 8 - processedPapers.length;
        const webPapers = await processInBatches(
          eligibleWeb,
          processWebResult,
          remaining,
        );
        processedPapers.push(...webPapers);
      }

      await updateProgress(scrollId, "exporting");

      // 5. Generate comments for new papers
      const paperComments = await generateCommentsForPapers(processedPapers);

      // 6. Persist new papers and comments
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
              embedding: p.embedding ? JSON.stringify(p.embedding) : null,
              groundingData: p.groundingData
                ? JSON.stringify(p.groundingData)
                : null,
            })),
          )
          .returning();

        // Insert comments
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

        // Update paper count
        await db
          .update(scrolls)
          .set({
            paperCount: sql`${scrolls.paperCount} + ${processedPapers.length}`,
          })
          .where(eq(scrolls.id, scrollId));
      }

      // 7. Mark complete
      await db
        .update(scrolls)
        .set({
          status: "complete",
          progress: null,
        })
        .where(eq(scrolls.id, scrollId));

      console.log(
        `[generate-more] Complete: ${processedPapers.length} new papers for scroll ${scrollId}`,
      );
    } catch (err) {
      console.error(`[generate-more] Failed for ${scrollId}:`, err);
      await db
        .update(scrolls)
        .set({
          status: "complete",
          progress: null,
        })
        .where(eq(scrolls.id, scrollId));
    }
  });

  return Response.json({ generating: true });
}
