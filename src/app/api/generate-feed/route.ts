import { after } from "next/server";
import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
  generateSocialComments,
  setModels,
  configureProvider,
  OLLAMA_CONCURRENCY,
  OLLAMA_COMMENT_CONCURRENCY,
} from "@/lib/ollama";
import type { AiProviderType } from "@/lib/ai-provider";
import { verifyCard } from "@/lib/grounding";
import { webSearch } from "@/lib/search";
import { searchPapers, type RawPaper } from "@/lib/paper-search";
import { db } from "@/lib/db";
import { scrolls, papers, comments, polls } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { Paper, ExportTheme } from "@/lib/types";
import { getPdf } from "@/lib/r2";
import { extractPdfContent, pdfToRawPaper } from "@/lib/pdf-extract";
import {
  safeEmbed,
  safeEmbedBatch,
  rankBySimilarity,
  findSimilarPairs,
} from "@/lib/embeddings";

const CONCURRENCY = OLLAMA_CONCURRENCY;

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

/** Best-effort progress update — never throws so rate-limit errors don't kill the feed generation. */
async function updateProgress(
  scrollId: string,
  step: string,
  extra: Record<string, number> = {},
) {
  try {
    await db
      .update(scrolls)
      .set({ progress: JSON.stringify({ step, ...extra }) })
      .where(eq(scrolls.id, scrollId));
  } catch (err) {
    console.warn(`[updateProgress] Failed (non-fatal): ${step}`, err);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    topic?: string;
    description?: string;
    subfields?: string[];
    mode?: string;
    fastModel?: string;
    smartModel?: string;
    pdfKeys?: string[];
    sourceMode?: "include" | "context_only" | "only_sources";
    provider?: AiProviderType;
    ollamaUrl?: string;
  };

  const { topic, description, subfields, pdfKeys, sourceMode } = body;

  // Apply user-selected model and provider overrides for this request
  setModels(body.fastModel, body.smartModel);
  if (body.provider) {
    configureProvider(body.provider, body.ollamaUrl);
  }

  const hasPdfs = pdfKeys && pdfKeys.length > 0;
  const effectiveSourceMode = hasPdfs ? sourceMode || "include" : undefined;
  const isOnlySources = effectiveSourceMode === "only_sources";

  // Topic is required unless only_sources mode
  if (!topic && !isOnlySources) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }

  try {
    const scrollTitle = topic || "Uploaded Sources";

    // Create scroll record immediately with "generating" status
    const [scroll] = await db
      .insert(scrolls)
      .values({
        title: scrollTitle,
        description:
          description ||
          (topic
            ? `Exploring research on ${topic}.`
            : "Feed from uploaded PDF sources."),
        mode: isOnlySources
          ? "pdf_only"
          : effectiveSourceMode === "context_only"
            ? "pdf_context"
            : hasPdfs
              ? "pdf_include"
              : "research",
        date: new Date().toISOString().split("T")[0],
        paperCount: 0,
        status: "generating",
        aiProvider: body.provider || "ollama",
        progress: JSON.stringify({
          step: hasPdfs ? "extracting" : "searching",
        }),
      })
      .returning();

    const scrollId = scroll.id;

    // Run heavy processing in background after returning response
    after(async () => {
      try {
        // ── Step 0: Extract PDFs if provided ──
        let pdfPapers: RawPaper[] = [];
        let pdfContextText = "";

        if (hasPdfs) {
          await updateProgress(scrollId, "extracting");

          for (const key of pdfKeys) {
            try {
              const buffer = await getPdf(key);
              if (!buffer) {
                console.warn(`PDF not found in R2: ${key}`);
                continue;
              }
              const extracted = await extractPdfContent(
                buffer,
                key.split("/").pop() || "document.pdf",
              );
              pdfPapers.push(pdfToRawPaper(extracted));
              // Accumulate context text for context_only mode
              pdfContextText += `\n\n--- ${extracted.title} ---\n${extracted.text.slice(0, 2000)}`;
            } catch (err) {
              console.error(`Failed to extract PDF ${key}:`, err);
            }
          }

          console.log(
            `[generate-feed] Extracted ${pdfPapers.length} papers from ${pdfKeys.length} PDFs`,
          );

          // If topic was not provided (only_sources mode), derive from PDF titles
          if (!topic && pdfPapers.length > 0) {
            const derivedTitle = pdfPapers
              .map((p) => p.title)
              .slice(0, 3)
              .join(", ");
            await db
              .update(scrolls)
              .set({ title: derivedTitle })
              .where(eq(scrolls.id, scrollId));
          }
        }

        // ── Step 1: Search for papers (skip if only_sources) ──
        let academicPapers: RawPaper[] = [];
        let webResults: {
          title: string;
          url: string;
          snippet: string;
          engine: string;
        }[] = [];

        if (!isOnlySources) {
          await updateProgress(scrollId, "searching");

          let searchQuery = topic || "";
          if (subfields?.length) {
            searchQuery += " " + subfields.slice(0, 2).join(" ");
          }

          [academicPapers, webResults] = await Promise.all([
            searchPapers(searchQuery, 20),
            webSearch(searchQuery, 15).catch((err) => {
              console.error("Web search failed:", err);
              return [] as typeof webResults;
            }),
          ]);

          console.log(
            `[generate-feed] ${academicPapers.length} academic papers, ${webResults.length} web results`,
          );
        }

        // Merge PDF papers based on sourceMode
        if (effectiveSourceMode === "include") {
          academicPapers = [...pdfPapers, ...academicPapers];
        } else if (effectiveSourceMode === "only_sources") {
          academicPapers = pdfPapers;
        }
        // context_only: pdfPapers not added to academicPapers — used as context only

        // ── Embedding-based ranking (merged into "searching" progress step to reduce DB calls) ──

        // Embed the query for relevance ranking
        const queryText = [topic, description, ...(subfields || [])]
          .filter(Boolean)
          .join(" ");
        const queryEmbedding = queryText ? await safeEmbed(queryText) : null;

        // Store query embedding on scroll (best-effort, non-critical)
        if (queryEmbedding) {
          try {
            await db
              .update(scrolls)
              .set({ queryEmbedding: JSON.stringify(queryEmbedding) })
              .where(eq(scrolls.id, scrollId));
          } catch {
            console.warn(
              "[generate-feed] Failed to store query embedding (non-fatal)",
            );
          }
        }

        // Embed papers that don't already have embeddings (from searchPapers dedup)
        const needsEmbedding = academicPapers.filter((p) => !p.embedding);
        if (needsEmbedding.length > 0) {
          const texts = needsEmbedding.map(
            (p) => `${p.title}. ${p.abstract.slice(0, 500)}`,
          );
          const newEmbeddings = await safeEmbedBatch(texts);
          if (newEmbeddings) {
            needsEmbedding.forEach((p, i) => {
              p.embedding = newEmbeddings[i];
            });
          }
        }

        // Rank by relevance: PDF similarity (if PDFs) or query similarity
        if (
          hasPdfs &&
          pdfPapers.some((p) => p.embedding) &&
          effectiveSourceMode !== "only_sources"
        ) {
          // For PDF modes: rank academic papers by similarity to uploaded PDFs
          const pdfEmbeddings = pdfPapers
            .map((p) => p.embedding)
            .filter((e): e is number[] => !!e);

          if (pdfEmbeddings.length > 0) {
            // Score each academic paper by max similarity to any PDF
            const nonPdfPapers = academicPapers.filter(
              (p) => p.source !== "pdf_upload",
            );
            const pdfPapersInList = academicPapers.filter(
              (p) => p.source === "pdf_upload",
            );

            const scored = nonPdfPapers
              .map((paper) => {
                if (!paper.embedding) return { paper, score: 0 };
                const maxSim = Math.max(
                  ...pdfEmbeddings.map((pe) => {
                    let dot = 0,
                      magA = 0,
                      magB = 0;
                    for (let i = 0; i < pe.length; i++) {
                      dot += pe[i] * paper.embedding![i];
                      magA += pe[i] * pe[i];
                      magB += paper.embedding![i] * paper.embedding![i];
                    }
                    const denom = Math.sqrt(magA) * Math.sqrt(magB);
                    return denom === 0 ? 0 : dot / denom;
                  }),
                );
                return { paper, score: maxSim };
              })
              .sort((a, b) => b.score - a.score);

            // PDF papers first, then ranked academic papers
            academicPapers = [
              ...pdfPapersInList,
              ...scored.map((s) => s.paper),
            ];
            console.log(
              `[generate-feed] Ranked papers by PDF similarity (top score: ${scored[0]?.score.toFixed(3)})`,
            );
          }
        } else if (queryEmbedding) {
          // Rank by query relevance
          const papersWithEmb = academicPapers.filter((p) => p.embedding);
          const papersWithoutEmb = academicPapers.filter((p) => !p.embedding);

          if (papersWithEmb.length > 0) {
            const ranked = rankBySimilarity(
              queryEmbedding,
              papersWithEmb.map((p) => p.embedding!),
            );
            academicPapers = [
              ...ranked.map((r) => papersWithEmb[r.index]),
              ...papersWithoutEmb,
            ];
            console.log(
              `[generate-feed] Ranked ${papersWithEmb.length} papers by query similarity (top: ${ranked[0]?.score.toFixed(3)})`,
            );
          }
        }

        const total = Math.min(academicPapers.length, 12);
        await updateProgress(scrollId, "processing", {
          papersProcessed: 0,
          total,
        });

        // 2. Process academic papers — synthesis + verification
        let papersProcessed = 0;

        const processPaper = async (raw: RawPaper): Promise<Paper | null> => {
          try {
            // For context_only mode, prepend PDF context to the synthesis prompt
            const contextPrefix =
              effectiveSourceMode === "context_only" && pdfContextText
                ? `[User's reference material for context: ${pdfContextText.slice(0, 1500)}]\n\n`
                : "";

            const abstractForSynthesis = raw.abstract.slice(0, 2000);

            const [synthesis, apaCitation] = await Promise.all([
              generateSynthesis(
                raw.title,
                contextPrefix + abstractForSynthesis,
                raw.authors,
              ),
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
              await verifyCard(raw.abstract.slice(0, 2000), synthesis);
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
              peerReviewed: !!raw.venue && raw.source !== "pdf_upload",
              synthesis,
              credibilityScore,
              citationCount: raw.citationCount,
              commentCount: 0,
              apaCitation,
              isUserUpload: raw.source === "pdf_upload",
              embedding: raw.embedding,
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
          // Only update progress every 4 papers to reduce DB calls (Turso rate limit)
          if (
            i === 0 ||
            papersProcessed % 4 === 0 ||
            papersProcessed >= total
          ) {
            await updateProgress(scrollId, "processing", {
              papersProcessed: Math.min(papersProcessed, total),
              total,
            });
          }
        }

        // 3. Supplement with web results (always fill up to 12 total) — skip if only_sources
        if (
          !isOnlySources &&
          webResults.length > 0 &&
          processedPapers.length < 12
        ) {
          console.log(
            `${processedPapers.length} academic results, supplementing with ${webResults.length} web results`,
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
        const effectiveTopic = topic || scroll.title;

        const fallbackOutline = (): ExportTheme[] => [
          {
            title: effectiveTopic,
            summary: `Research papers on ${effectiveTopic}.`,
            sources: processedPapers.map((p) => ({
              title: p.title,
              authors: p.authors.join(", "),
              year: p.year,
              keyFinding: p.synthesis.split(".")[0] + ".",
              apaCitation: p.apaCitation,
            })),
          },
        ];

        // 5. Persist papers FIRST so the scroll is usable even if comments/outline time out
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
                    commentCount: 0,
                    apaCitation: p.apaCitation,
                    isUserUpload:
                      (p as Paper & { isUserUpload?: boolean }).isUserUpload ||
                      false,
                    embedding: p.embedding ? JSON.stringify(p.embedding) : null,
                    groundingData: p.groundingData
                      ? JSON.stringify(p.groundingData)
                      : null,
                  })),
                )
                .returning()
            : [];

        // Insert polls
        await db.insert(polls).values([
          {
            scrollId,
            type: "multiple-choice",
            question: `Which aspect of "${effectiveTopic}" interests you most?`,
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

        // Mark scroll as complete so the user can start browsing immediately
        await db
          .update(scrolls)
          .set({
            paperCount: processedPapers.length,
            status: "complete",
            progress: null,
            ...(hasPdfs ? { pdfKeys: JSON.stringify(pdfKeys) } : {}),
          })
          .where(eq(scrolls.id, scrollId));

        console.log(
          `Feed generation complete for scroll ${scrollId}: ${processedPapers.length} papers`,
        );

        // 6. Best-effort: generate comments and export outline AFTER marking complete.
        // These are nice-to-have — if the worker times out here, the scroll still works.
        type RawComment = {
          author: string;
          content: string;
          relationship: string;
        };

        try {
          // Build similarity pairs for comment matching
          const paperEmbeddings = processedPapers
            .map((p) => p.embedding)
            .filter((e): e is number[] => !!e);
          const hasPaperEmbeddings =
            paperEmbeddings.length === processedPapers.length;
          const similarPairs = hasPaperEmbeddings
            ? findSimilarPairs(paperEmbeddings, 4)
            : null;

          // Generate comments sequentially to avoid Ollama overload
          const rawComments = new Map<number, RawComment[]>();
          if (processedPapers.length >= 2) {
            for (let i = 0; i < processedPapers.length; i++) {
              const paper = processedPapers[i];

              let others;
              if (similarPairs && similarPairs.has(i)) {
                const similar = similarPairs.get(i)!;
                others = similar.map((s) => processedPapers[s.index]);
              } else {
                others = processedPapers
                  .filter((_, idx) => idx !== i)
                  .slice(0, 4);
              }

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
                    doi: o.doi,
                  })),
                  3,
                );
                rawComments.set(i, generatedComments);
              } catch (err) {
                console.warn(
                  `[best-effort] Failed to generate comments for paper ${i}:`,
                  err,
                );
              }
            }
          }

          // Persist comments
          const allComments: {
            paperId: string;
            content: string;
            author: string;
            isGenerated: boolean;
            relationship: string;
          }[] = [];

          processedPapers.forEach((_, idx) => {
            const cmts = rawComments.get(idx) || [];
            const dbPaper = insertedPapers[idx];
            if (dbPaper && cmts.length > 0) {
              for (const c of cmts) {
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
            // Update comment counts
            for (const [idx, cmts] of rawComments) {
              const dbPaper = insertedPapers[idx];
              if (dbPaper && cmts.length > 0) {
                await db
                  .update(papers)
                  .set({ commentCount: cmts.length })
                  .where(eq(papers.id, dbPaper.id));
              }
            }
          }

          // Generate export outline
          try {
            const outlineInput = processedPapers.map((p) => ({
              title: p.title,
              authors: p.authors.join(", "),
              year: p.year,
              synthesis: p.synthesis,
              apaCitation: p.apaCitation,
            }));
            const outlineJson = await generateExportOutline(outlineInput);
            const jsonMatch = outlineJson.match(/\{[\s\S]*\}/);
            let exportOutline: ExportTheme[] = fallbackOutline();
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]) as {
                  themes: ExportTheme[];
                };
                exportOutline = parsed.themes || fallbackOutline();
              } catch {
                console.warn("Export outline JSON malformed, using fallback");
              }
            }
            await db
              .update(scrolls)
              .set({ exportData: JSON.stringify(exportOutline) })
              .where(eq(scrolls.id, scrollId));
          } catch (err) {
            console.warn(
              "[best-effort] Export outline generation failed:",
              err,
            );
            await db
              .update(scrolls)
              .set({ exportData: JSON.stringify(fallbackOutline()) })
              .where(eq(scrolls.id, scrollId));
          }
        } catch (err) {
          console.warn("[best-effort] Post-completion enrichment failed:", err);
        }
      } catch (err) {
        console.error(
          `Background feed generation failed for ${scrollId}:`,
          err,
        );
        try {
          await db
            .update(scrolls)
            .set({
              status: "error",
              progress: JSON.stringify({
                step: "error",
                message:
                  err instanceof Error ? err.message : "Feed generation failed",
              }),
            })
            .where(eq(scrolls.id, scrollId));
        } catch {
          console.error(
            `[generate-feed] Failed to set error status for ${scrollId}`,
          );
        }
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
