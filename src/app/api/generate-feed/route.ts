import { after } from "next/server";
import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
  generateSocialComments,
  setModels,
} from "@/lib/ollama";
import { verifyCard } from "@/lib/grounding";
import { webSearch } from "@/lib/search";
import { searchPapers } from "@/lib/paper-search";
import { db } from "@/lib/db";
import { scrolls, papers, comments, polls } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { Paper, ExportTheme } from "@/lib/types";

const CONCURRENCY = 2; // Ollama processes sequentially, so keep low to avoid timeouts

async function processInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  maxResults: number,
): Promise<R[]> {
  const results: R[] = [];
  for (
    let i = 0;
    i < items.length && results.length < maxResults;
    i += CONCURRENCY
  ) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (results.length >= maxResults) break;
      if (r.status === "fulfilled" && r.value !== null) {
        results.push(r.value);
      }
    }
  }
  return results;
}

function computeCredibilityScore(paper: {
  citationCount: number;
  venue: string;
  year: number;
}): number {
  let score = 50;

  const citations = paper.citationCount || 0;
  if (citations > 10000) score += 30;
  else if (citations > 1000) score += 25;
  else if (citations > 100) score += 20;
  else if (citations > 10) score += 10;
  else if (citations > 0) score += 5;

  if (paper.venue) score += 15;

  const currentYear = new Date().getFullYear();
  if (paper.year && currentYear - paper.year <= 5) score += 5;
  else if (paper.year && currentYear - paper.year <= 15) score += 3;

  return Math.min(score, 99);
}

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
  const body = (await req.json()) as {
    topic: string;
    description?: string;
    subfields?: string[];
    mode?: string;
    fastModel?: string;
    smartModel?: string;
  };

  const { topic, description, subfields, mode } = body;

  // Apply user-selected model overrides for this request
  setModels(body.fastModel, body.smartModel);

  try {
    // Create scroll record immediately with "generating" status
    const [scroll] = await db
      .insert(scrolls)
      .values({
        title: topic,
        description: description || `Exploring research on ${topic}.`,
        mode: mode === "citationFinder" ? "citation-finder" : "brainstorm",
        date: new Date().toISOString().split("T")[0],
        paperCount: 0,
        status: "generating",
        progress: JSON.stringify({ step: "searching" }),
      })
      .returning();

    const scrollId = scroll.id;

    // Run heavy processing in background after returning response
    after(async () => {
      try {
        let searchQuery = topic;
        if (subfields?.length) {
          searchQuery += " " + subfields.slice(0, 2).join(" ");
        }

        // 1. Fetch papers from all academic APIs + web search in parallel
        const [academicPapers, webResults] = await Promise.all([
          searchPapers(searchQuery, 20),
          webSearch(searchQuery, 8).catch((err) => {
            console.error("Web search failed:", err);
            return [] as {
              title: string;
              url: string;
              snippet: string;
              engine: string;
            }[];
          }),
        ]);

        console.log(
          `[generate-feed] ${academicPapers.length} academic papers, ${webResults.length} web results`,
        );

        const total = Math.min(academicPapers.length, 12);
        await updateProgress(scrollId, "processing", {
          papersProcessed: 0,
          total,
        });

        // 2. Process academic papers — synthesis + verification
        let papersProcessed = 0;

        const processPaper = async (
          raw: (typeof academicPapers)[number],
        ): Promise<Paper | null> => {
          try {
            const [synthesis, apaCitation] = await Promise.all([
              generateSynthesis(raw.title, raw.abstract, raw.authors),
              generateApaCitation(
                raw.title,
                raw.authors,
                raw.year,
                raw.venue,
                raw.doi,
              ),
            ]);

            // Verify synthesis — advisory only, don't reject papers
            try {
              await verifyCard(raw.abstract, synthesis);
            } catch {
              // verification service unavailable — continue
            }

            const credibilityScore = computeCredibilityScore({
              citationCount: raw.citationCount,
              venue: raw.venue,
              year: raw.year,
            });

            return {
              id: raw.id,
              title: raw.title,
              authors: raw.authors,
              journal: raw.venue,
              year: raw.year,
              doi: raw.doi,
              peerReviewed: !!raw.venue,
              synthesis,
              credibilityScore,
              citationCount: raw.citationCount,
              commentCount: 0,
              apaCitation,
            };
          } catch (err) {
            console.error(`Failed to process paper "${raw.title}":`, err);
            return null;
          }
        };

        // Process with progress tracking per batch
        const processedPapers: Paper[] = [];
        for (
          let i = 0;
          i < academicPapers.length && processedPapers.length < 12;
          i += CONCURRENCY
        ) {
          const batch = academicPapers.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            batch.map(processPaper),
          );
          for (const r of batchResults) {
            if (processedPapers.length >= 12) break;
            if (r.status === "fulfilled" && r.value !== null) {
              processedPapers.push(r.value);
            }
          }
          papersProcessed = Math.min(i + CONCURRENCY, academicPapers.length);
          await updateProgress(scrollId, "processing", {
            papersProcessed: Math.min(papersProcessed, total),
            total,
          });
        }

        // 3. Supplement with web results if we have too few papers
        if (processedPapers.length < 6) {
          console.log(
            `Only ${processedPapers.length} academic results, supplementing with web search`,
          );

          const existingTitles = new Set(
            processedPapers.map((p) => p.title.toLowerCase()),
          );

          const eligibleWebResults = webResults.filter(
            (r) =>
              r.snippet &&
              r.snippet.length >= 20 &&
              !existingTitles.has(r.title.toLowerCase()),
          );

          const processWebResult = async (
            result: (typeof webResults)[number],
          ): Promise<Paper | null> => {
            try {
              const [synthesis, apaCitation] = await Promise.all([
                generateSynthesis(result.title, result.snippet, []),
                generateApaCitation(
                  result.title,
                  [],
                  new Date().getFullYear(),
                  result.engine || "Web",
                  result.url,
                ),
              ]);

              return {
                id: `web-${Math.random().toString(36).slice(2)}`,
                title: result.title,
                authors: [],
                journal: result.engine || "Web Source",
                year: new Date().getFullYear(),
                doi: result.url,
                peerReviewed: false,
                synthesis,
                credibilityScore: 40,
                citationCount: 0,
                commentCount: 0,
                apaCitation,
              };
            } catch (err) {
              console.error(
                `Failed to process web result "${result.title}":`,
                err,
              );
              return null;
            }
          };

          const remaining = 12 - processedPapers.length;
          const webPapers = await processInBatches(
            eligibleWebResults,
            processWebResult,
            remaining,
          );
          processedPapers.push(...webPapers);
        }

        // 4. Generate export outline
        await updateProgress(scrollId, "exporting");

        const fallbackOutline = (): ExportTheme[] => [
          {
            title: topic,
            summary: `Research papers on ${topic}.`,
            sources: processedPapers.map((p) => ({
              title: p.title,
              authors: p.authors.join(", "),
              year: p.year,
              keyFinding: p.synthesis.split(".")[0] + ".",
              apaCitation: p.apaCitation,
            })),
          },
        ];

        // Run export outline generation in parallel with social comments
        const outlinePromise =
          processedPapers.length > 0
            ? (async () => {
                try {
                  const outlineInput = processedPapers.map((p) => ({
                    title: p.title,
                    authors: p.authors.join(", "),
                    year: p.year,
                    synthesis: p.synthesis,
                    apaCitation: p.apaCitation,
                  }));
                  const outlineJson =
                    await generateExportOutline(outlineInput);
                  const jsonMatch = outlineJson.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    try {
                      const parsed = JSON.parse(jsonMatch[0]) as {
                        themes: ExportTheme[];
                      };
                      return parsed.themes || [];
                    } catch {
                      console.warn(
                        "Export outline JSON malformed, using fallback",
                      );
                      return fallbackOutline();
                    }
                  }
                  return fallbackOutline();
                } catch (err) {
                  console.error("Failed to generate export outline:", err);
                  return fallbackOutline();
                }
              })()
            : Promise.resolve([] as ExportTheme[]);

        // 5. Generate social comments — papers reacting to each other
        type RawComment = {
          author: string;
          content: string;
          relationship: string;
        };
        const commentPromise = (async (): Promise<
          Map<number, RawComment[]>
        > => {
          const rawComments = new Map<number, RawComment[]>();
          if (processedPapers.length < 2) return rawComments;

          const commentBatchSize = 3;
          for (
            let i = 0;
            i < processedPapers.length;
            i += commentBatchSize
          ) {
            const batch = processedPapers.slice(i, i + commentBatchSize);
            const batchPromises = batch.map(async (paper, batchIdx) => {
              const paperIdx = i + batchIdx;
              const others = processedPapers
                .filter((_, idx) => idx !== paperIdx)
                .slice(0, 4);

              try {
                const generatedComments = await generateSocialComments(
                  {
                    title: paper.title,
                    synthesis: paper.synthesis,
                    authors: paper.authors,
                  },
                  others.map((o) => ({
                    title: o.title,
                    synthesis: o.synthesis,
                    authors: o.authors,
                    year: o.year,
                    citationCount: o.citationCount,
                  })),
                  3,
                );
                rawComments.set(paperIdx, generatedComments);
              } catch (err) {
                console.error(
                  `Failed to generate comments for paper ${paperIdx}:`,
                  err,
                );
              }
            });

            await Promise.all(batchPromises);
          }

          return rawComments;
        })();

        // Wait for both outline and comments
        const [exportOutline, paperComments] = await Promise.all([
          outlinePromise,
          commentPromise,
        ]);

        // 6. Persist papers, comments, polls and mark scroll as complete
        const insertedPapers =
          processedPapers.length > 0
            ? await db
                .insert(papers)
                .values(
                  processedPapers.map((p) => ({
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
                    commentCount: (
                      paperComments.get(processedPapers.indexOf(p)) || []
                    ).length,
                    apaCitation: p.apaCitation,
                  })),
                )
                .returning()
            : [];

        // Insert generated comments for each paper
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

        // Insert polls
        await db.insert(polls).values([
          {
            scrollId,
            type: "multiple-choice",
            question: `Which aspect of "${topic}" interests you most?`,
            options: JSON.stringify(
              subfields && subfields.length >= 2
                ? subfields.slice(0, 4)
                : [
                    "Foundational theories",
                    "Recent developments",
                    "Practical applications",
                    "Methodological approaches",
                  ],
            ),
          },
          {
            scrollId,
            type: "multiple-choice",
            question: "What type of research sources do you prefer?",
            options: JSON.stringify([
              "Foundational/classic papers (pre-2000)",
              "Modern empirical studies (2000\u20132015)",
              "Recent cutting-edge research (2015+)",
              "A mix of all eras",
            ]),
          },
          {
            scrollId,
            type: "open-ended",
            question:
              "What specific research question are you trying to answer?",
          },
        ]);

        // Mark scroll as complete
        await db
          .update(scrolls)
          .set({
            paperCount: processedPapers.length,
            exportData: JSON.stringify(exportOutline),
            status: "complete",
            progress: null,
          })
          .where(eq(scrolls.id, scrollId));

        console.log(
          `Feed generation complete for scroll ${scrollId}: ${processedPapers.length} papers`,
        );
      } catch (err) {
        console.error(
          `Background feed generation failed for ${scrollId}:`,
          err,
        );
        await db
          .update(scrolls)
          .set({
            status: "error",
            progress: JSON.stringify({
              step: "error",
              message:
                err instanceof Error
                  ? err.message
                  : "Feed generation failed",
            }),
          })
          .where(eq(scrolls.id, scrollId));
      }
    });

    // Return immediately with the scroll ID
    return Response.json({ scroll: { id: scroll.id } });
  } catch (err) {
    console.error("Feed generation failed:", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Feed generation failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
