import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
  expandSearchQuery,
  setModels,
  configureProvider,
} from "@/lib/ollama";
import { searchPapers, type RawPaper } from "@/lib/paper-search";
import { webSearch } from "@/lib/search";
import { getPdf, uploadImage } from "@/lib/r2";
import { fetchPdfAndExtractFigure } from "@/lib/pdf-images";
import { fillScrollImages } from "@/lib/image-fill";
import { extractPdfContent, pdfToRawPaper } from "@/lib/pdf-extract";
import { db } from "@/lib/db";
import { scrolls, papers, polls } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import type { AiProviderType } from "@/lib/ai-provider";
import type { ExportTheme } from "@/lib/types";

// How many papers to synthesize in parallel.
// Ollama queues concurrent requests internally; 3 keeps it saturated without
// overwhelming a tunnelled/local instance.
const SYNTHESIS_CONCURRENCY = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

interface RunBody {
  topic?: string;
  description?: string;
  subfields?: string[];
  fastModel?: string;
  smartModel?: string;
  pdfKeys?: string[];
  sourceMode?: "include" | "context_only" | "only_sources";
  provider?: AiProviderType;
  ollamaUrl?: string;
}

type SseEvent =
  | { type: "init"; scrollId: string }
  | { type: "progress"; step: string; papersProcessed?: number; total?: number }
  | { type: "complete"; scrollId: string }
  | { type: "error"; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Runs `fn` over `items` with at most `concurrency` tasks running at once.
 * Calls `onItem` after each item completes (for streaming progress).
 */
async function withConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
}

const PENDING_SYNTHESIS = "__PENDING__";

// ─── Main endpoint ────────────────────────────────────────────────────────────

/**
 * Single-request feed generation with SSE progress streaming.
 *
 * Unlike the old process-next polling loop (one paper per HTTP round-trip),
 * this endpoint does all work inline and streams progress events as each
 * paper completes. Papers are synthesized in parallel (SYNTHESIS_CONCURRENCY).
 *
 * Requires Cloudflare Workers paid plan (30 s CPU / long-lived responses).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as RunBody;
  const { topic, description, subfields, pdfKeys, sourceMode, provider, ollamaUrl, fastModel, smartModel } = body;

  const hasPdfs = pdfKeys && pdfKeys.length > 0;
  const effectiveSourceMode = hasPdfs ? sourceMode || "include" : undefined;
  const isOnlySources = effectiveSourceMode === "only_sources";

  if (!topic && !isOnlySources) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }

  // Configure AI provider & models up front
  setModels(fastModel, smartModel);
  if (provider) configureProvider(provider, ollamaUrl);

  // Create the scroll record immediately so we have an ID to stream back
  const scrollTitle = topic || "Uploaded Sources";
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
      aiProvider: provider || "ollama",
      progress: JSON.stringify({ step: "searching" }),
      rawResults: null,
    })
    .returning();

  const scrollId = scroll.id;
  const enc = new TextEncoder();

  function encode(event: SseEvent): Uint8Array {
    return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encode({ type: "init", scrollId }));
        controller.enqueue(
          encode({ type: "progress", step: "searching" }),
        );

        // ── Extract PDFs ──────────────────────────────────────────────────
        const pdfPapers: RawPaper[] = [];
        let pdfContextText = "";

        if (hasPdfs && pdfKeys) {
          controller.enqueue(encode({ type: "progress", step: "extracting" }));
          for (const key of pdfKeys) {
            try {
              const buffer = await getPdf(key);
              if (!buffer) continue;
              const extracted = await extractPdfContent(
                buffer,
                key.split("/").pop() || "document.pdf",
              );
              pdfPapers.push(pdfToRawPaper(extracted));
              pdfContextText += `\n\n--- ${extracted.title} ---\n${extracted.text.slice(0, 2000)}`;
            } catch (err) {
              console.error(`[run] Failed to extract PDF ${key}:`, err);
            }
          }

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

        // ── Academic + web search ─────────────────────────────────────────
        let academicPapers: RawPaper[] = [];
        let webPapersList: RawPaper[] = [];

        if (!isOnlySources) {
          // Expand and correct the user's query before searching
          controller.enqueue(encode({ type: "progress", step: "expanding" }));
          let expandedQuery = { correctedTopic: topic || "", keywords: [] as string[], relatedTerms: [] as string[] };
          // academicQuery: short and focused (academic APIs work best with 2-4 words)
          // webQuery: broader expansion (SearXNG handles natural-language queries well)
          let academicQuery = topic || "";
          let webQuery = topic || "";
          if (topic) {
            try {
              expandedQuery = await expandSearchQuery(topic, description, subfields);
              // Academic APIs: corrected topic ONLY — extra keywords hurt recall
              academicQuery = expandedQuery.correctedTopic || topic;
              // Web search: full expansion for broader coverage
              webQuery = [
                expandedQuery.correctedTopic,
                ...expandedQuery.keywords.slice(0, 4),
                ...expandedQuery.relatedTerms.slice(0, 2),
              ].filter(Boolean).join(" ");
              console.log(`[run] Academic query: "${academicQuery}" | Web query: "${webQuery}"`);
              // Update scroll title if spelling was corrected
              if (expandedQuery.correctedTopic && expandedQuery.correctedTopic.toLowerCase() !== topic.toLowerCase()) {
                await db.update(scrolls).set({ title: expandedQuery.correctedTopic }).where(eq(scrolls.id, scrollId)).catch(() => {});
              }
            } catch {
              academicQuery = topic || "";
              if (subfields?.length) academicQuery += " " + subfields.slice(0, 1).join(" ");
              webQuery = academicQuery;
            }
          } else if (subfields?.length) {
            academicQuery += " " + subfields.slice(0, 1).join(" ");
            webQuery = academicQuery;
          }

          // Build multiple academic query variations: full topic + each keyword individually
          // Running them in parallel across academic APIs gives far more unique paper results
          const academicQueryVariants = [
            academicQuery,
            ...expandedQuery.keywords.slice(0, 3),
          ].filter((q): q is string => Boolean(q?.trim()));
          const uniqueAcademicQueries = [...new Set(academicQueryVariants)];

          const [allAcademicSets, webResults] = await Promise.all([
            Promise.all(
              uniqueAcademicQueries.map((q) =>
                searchPapers(q, 15, { skipEmbeddings: true }).catch((err) => {
                  console.error(`[run] searchPapers("${q}") failed:`, err);
                  return [] as RawPaper[];
                }),
              ),
            ),
            webSearch(webQuery, 15).catch((err) => {
              console.error(`[run] webSearch failed:`, err);
              return [] as {
                title: string;
                url: string;
                snippet: string;
                engine: string;
              }[];
            }),
          ]);

          // Merge and deduplicate all academic results by title
          const seenAcademic = new Set<string>();
          for (const results of allAcademicSets) {
            for (const paper of results) {
              const key = paper.title.toLowerCase().trim();
              if (!seenAcademic.has(key)) {
                seenAcademic.add(key);
                academicPapers.push(paper);
              }
            }
          }
          console.log(`[run] Merged ${academicPapers.length} unique academic papers from ${uniqueAcademicQueries.length} queries`);
          webPapersList = webResults
            .filter((r) => r.snippet && r.snippet.length >= 20)
            .map((r) => ({
              id: `web-${Math.random().toString(36).slice(2)}`,
              title: r.title,
              abstract: r.snippet,
              authors: [] as string[],
              venue: r.engine || "Web Source",
              year: new Date().getFullYear(),
              doi: r.url,
              citationCount: 0,
              source: "web" as const,
            }));
        }

        // Merge PDFs according to sourceMode
        if (effectiveSourceMode === "include") {
          academicPapers = [...pdfPapers, ...academicPapers];
        } else if (effectiveSourceMode === "only_sources") {
          academicPapers = pdfPapers;
        }

        academicPapers.sort(
          (a, b) => (b.citationCount || 0) - (a.citationCount || 0),
        );

        const targetAcademic = Math.min(academicPapers.length, 12);
        const targetWeb = Math.min(webPapersList.length, 12 - targetAcademic);
        const academicTitles = new Set(
          academicPapers
            .slice(0, targetAcademic)
            .map((p) => p.title.toLowerCase()),
        );
        const dedupedWeb = webPapersList.filter(
          (w) => !academicTitles.has(w.title.toLowerCase()),
        );
        const allPapers = [
          ...academicPapers.slice(0, targetAcademic),
          ...dedupedWeb.slice(0, targetWeb),
        ];

        const total = allPapers.length;
        console.log(`[run] ${total} papers found for "${topic}"`);

        // ── Insert papers with placeholder synthesis ───────────────────────
        if (total > 0) {
          const paperRows = allPapers.map((p) => {
            const isWeb = p.source === "web";
            return {
              scrollId,
              externalId: p.id,
              title: p.title,
              authors: JSON.stringify(p.authors || []),
              journal: p.venue || (isWeb ? "Web Source" : "Academic Publication"),
              year: p.year || new Date().getFullYear(),
              doi: p.doi || "",
              peerReviewed: !!p.venue && p.source !== "pdf_upload" && !isWeb,
              synthesis: PENDING_SYNTHESIS,
              credibilityScore: isWeb
                ? 40
                : computeCredibilityScore({
                    citationCount: p.citationCount || 0,
                    venue: p.venue || "",
                    year: p.year || 0,
                  }),
              citationCount: p.citationCount || 0,
              commentCount: 0,
              apaCitation: "",
              isUserUpload: p.source === "pdf_upload",
              groundingData: JSON.stringify({
                abstract: (p.abstract || "").slice(0, 2000),
                openAccessPdfUrl: p.openAccessPdfUrl || null,
              }),
            };
          });

          // D1 HTTP API limits: 100 bound params per query; each row = 16 params → chunk at 6
          const CHUNK_SIZE = 6;
          for (let i = 0; i < paperRows.length; i += CHUNK_SIZE) {
            await db.insert(papers).values(paperRows.slice(i, i + CHUNK_SIZE));
          }
        }

        // Update scroll progress
        await db
          .update(scrolls)
          .set({
            paperCount: total,
            progress: JSON.stringify({ step: "processing", papersProcessed: 0, total }),
            ...(hasPdfs ? { pdfKeys: JSON.stringify(pdfKeys) } : {}),
          })
          .where(eq(scrolls.id, scrollId));

        controller.enqueue(
          encode({ type: "progress", step: "processing", papersProcessed: 0, total }),
        );

        // ── Parallel paper synthesis ──────────────────────────────────────
        // Fetch inserted paper IDs so we can update them
        const insertedPapers = await db.query.papers.findMany({
          where: eq(papers.scrollId, scrollId),
        });

        let processed = 0;
        const contextPrefix =
          effectiveSourceMode === "context_only" && pdfContextText
            ? `[User's reference material for context: ${pdfContextText.slice(0, 1500)}]\n\n`
            : "";

        // Track which papers received images during synthesis (for the fill pass below)
        const papersWithImages = new Set<string>();

        await withConcurrency(
          insertedPapers,
          async (paper) => {
            try {
              let abstract = "";
              let openAccessPdfUrl: string | null = null;
              if (paper.groundingData) {
                try {
                  const gd = JSON.parse(paper.groundingData) as {
                    abstract?: string;
                    openAccessPdfUrl?: string | null;
                  };
                  abstract = gd.abstract || "";
                  openAccessPdfUrl = gd.openAccessPdfUrl || null;
                } catch { /* ignore */ }
              }

              const [synthesis, apaCitation] = await Promise.all([
                generateSynthesis(
                  paper.title,
                  contextPrefix + abstract,
                  JSON.parse(paper.authors || "[]") as string[],
                ),
                generateApaCitation(
                  paper.title,
                  JSON.parse(paper.authors || "[]") as string[],
                  paper.year || 0,
                  paper.journal || "",
                  paper.doi || "",
                ),
              ]);

              // Best-effort figure extraction
              let imageKey: string | null = null;
              if (openAccessPdfUrl) {
                try {
                  const pngBuffer = await fetchPdfAndExtractFigure(openAccessPdfUrl);
                  if (pngBuffer) {
                    const key = `images/${scrollId}/${paper.id}.png`;
                    await uploadImage(pngBuffer, key);
                    imageKey = key;
                  }
                } catch { /* ignore */ }
              }

              if (imageKey) papersWithImages.add(paper.id);

              await db
                .update(papers)
                .set({
                  synthesis,
                  apaCitation,
                  groundingData: null,
                  ...(imageKey ? { imageKey } : {}),
                })
                .where(eq(papers.id, paper.id));
            } catch (err) {
              console.error(`[run] Failed to process "${paper.title}":`, err);
              // Mark as skipped so the feed still shows something
              await db
                .update(papers)
                .set({
                  synthesis: `[Summary unavailable for "${paper.title}"]`,
                  apaCitation: paper.title,
                  groundingData: null,
                })
                .where(eq(papers.id, paper.id))
                .catch(() => {});
            }

            processed++;
            const progressStep = processed >= total ? "exporting" : "processing";

            // Update DB progress incrementally (non-blocking best effort)
            db.update(scrolls)
              .set({
                progress: JSON.stringify({
                  step: progressStep,
                  papersProcessed: processed,
                  total,
                }),
              })
              .where(eq(scrolls.id, scrollId))
              .catch(() => {});

            controller.enqueue(
              encode({
                type: "progress",
                step: progressStep,
                papersProcessed: processed,
                total,
              }),
            );
          },
          SYNTHESIS_CONCURRENCY,
        );

        // ── Fill missing images (every 3rd paper must have an image) ──────
        await fillScrollImages(
          scrollId,
          insertedPapers.map((p) => ({ id: p.id, title: p.title })),
          papersWithImages,
          [expandedQuery.correctedTopic, ...expandedQuery.keywords].filter(Boolean),
        );

        // ── Finalize ──────────────────────────────────────────────────────
        controller.enqueue(encode({ type: "progress", step: "exporting" }));

        const effectiveTopic = topic || scrollTitle;

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
              "Modern empirical studies (2000–2015)",
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

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(papers)
          .where(eq(papers.scrollId, scrollId));

        await db
          .update(scrolls)
          .set({
            status: "complete",
            progress: null,
            rawResults: null,
            paperCount: Number(count),
          })
          .where(eq(scrolls.id, scrollId));

        // Best-effort export outline (non-blocking)
        generateAndSaveExportOutline(scrollId, effectiveTopic).catch(() => {});

        console.log(`[run] Scroll ${scrollId} complete with ${count} papers`);
        controller.enqueue(encode({ type: "complete", scrollId }));
      } catch (err) {
        console.error(`[run] Fatal error for scroll ${scrollId}:`, err);
        const message =
          err instanceof Error ? err.message : "Feed generation failed";

        db.update(scrolls)
          .set({
            status: "error",
            progress: JSON.stringify({ step: "error", message }),
          })
          .where(eq(scrolls.id, scrollId))
          .catch(() => {});

        controller.enqueue(encode({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── Export outline (best-effort, fires after complete event) ─────────────────

async function generateAndSaveExportOutline(scrollId: string, topic: string) {
  const scrollPapers = await db.query.papers.findMany({
    where: eq(papers.scrollId, scrollId),
  });
  if (scrollPapers.length === 0) return;

  const outlineInput = scrollPapers.map((p) => ({
    title: p.title,
    authors: p.authors,
    year: p.year,
    synthesis: p.synthesis,
    apaCitation: p.apaCitation,
  }));

  const fallbackOutline = (): ExportTheme[] => [
    {
      title: topic,
      summary: `Research papers on ${topic}.`,
      sources: scrollPapers.map((p) => ({
        title: p.title,
        authors: p.authors,
        year: p.year,
        keyFinding: p.synthesis.split(".")[0] + ".",
        apaCitation: p.apaCitation,
      })),
    },
  ];

  try {
    const outlineJson = await generateExportOutline(outlineInput);
    const jsonMatch = outlineJson.match(/\{[\s\S]*\}/);
    let exportOutline: ExportTheme[] = fallbackOutline();
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { themes: ExportTheme[] };
        exportOutline = parsed.themes || fallbackOutline();
      } catch { /* malformed JSON */ }
    }
    await db
      .update(scrolls)
      .set({ exportData: JSON.stringify(exportOutline) })
      .where(eq(scrolls.id, scrollId));
  } catch {
    await db
      .update(scrolls)
      .set({ exportData: JSON.stringify(fallbackOutline()) })
      .where(eq(scrolls.id, scrollId));
  }
}
