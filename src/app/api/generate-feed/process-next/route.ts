import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
  setModels,
  configureProvider,
} from "@/lib/ollama";
import { searchPapers, type RawPaper } from "@/lib/paper-search";
import { webSearch } from "@/lib/search";
import { getPdf } from "@/lib/r2";
import { extractPdfContent, pdfToRawPaper } from "@/lib/pdf-extract";
import { db } from "@/lib/db";
import { scrolls, papers, polls } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import type { ExportTheme } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Config {
  provider?: string;
  ollamaUrl?: string;
  fastModel?: string;
  smartModel?: string;
  topic?: string;
  description?: string;
  subfields?: string[];
  sourceMode?: string;
  pdfKeys?: string[];
  pdfContextText?: string;
}

interface RawResultsSearch {
  phase: "search";
  config: Config;
}

interface RawResultsProcess {
  phase: "process";
  papers: RawPaper[];
  nextIndex: number;
  config: Config;
}

type RawResultsData = RawResultsSearch | RawResultsProcess;

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

function applyProviderConfig(config: Config) {
  setModels(config.fastModel, config.smartModel);
  if (config.provider) {
    configureProvider(
      config.provider as "ollama" | "cloudflare",
      config.ollamaUrl,
    );
  }
}

// ─── Main endpoint ───────────────────────────────────────────────────────────

/**
 * Multi-step feed generation driver.
 * The client calls this repeatedly. Each call does one unit of work:
 *
 * Phase "search": Search APIs + save raw results (~5-8ms CPU, no embeddings)
 * Phase "process": Process ONE paper (synthesis + citation + DB insert) (~3-5ms CPU)
 * Finalize: Insert polls, mark complete (~1ms CPU)
 */
export async function POST(req: Request) {
  const { scrollId } = (await req.json()) as { scrollId: string };

  if (!scrollId) {
    return Response.json({ error: "scrollId required" }, { status: 400 });
  }

  const scroll = await db.query.scrolls.findFirst({
    where: eq(scrolls.id, scrollId),
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }
  if (scroll.status === "complete") {
    return Response.json({ status: "complete", progress: null, done: true });
  }
  if (scroll.status === "error") {
    const progress = scroll.progress ? JSON.parse(scroll.progress) : null;
    return Response.json({ status: "error", progress, done: true });
  }
  if (!scroll.rawResults) {
    return Response.json({
      status: scroll.status,
      progress: scroll.progress ? JSON.parse(scroll.progress) : null,
      done: scroll.status !== "generating",
    });
  }

  const rawData = JSON.parse(scroll.rawResults) as RawResultsData;

  if (rawData.phase === "search") {
    return await handleSearchPhase(scrollId, scroll, rawData);
  } else {
    return await handleProcessPhase(scrollId, scroll, rawData);
  }
}

// ─── Phase: Search ───────────────────────────────────────────────────────────

async function handleSearchPhase(
  scrollId: string,
  scroll: { title: string },
  rawData: RawResultsSearch,
) {
  const { config } = rawData;
  const hasPdfs = config.pdfKeys && config.pdfKeys.length > 0;
  const isOnlySources = config.sourceMode === "only_sources";

  console.log(
    `[process-next] Search phase for scroll ${scrollId}, topic: "${config.topic}"`,
  );

  try {
    // ── Extract PDFs if provided ──
    const pdfPapers: RawPaper[] = [];
    let pdfContextText = "";

    if (hasPdfs && config.pdfKeys) {
      await updateProgress(scrollId, "extracting");

      for (const key of config.pdfKeys) {
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
          console.error(`Failed to extract PDF ${key}:`, err);
        }
      }

      if (!config.topic && pdfPapers.length > 0) {
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

    // ── Search for papers ──
    let academicPapers: RawPaper[] = [];
    let webPapersList: RawPaper[] = [];

    if (!isOnlySources) {
      await updateProgress(scrollId, "searching");

      let searchQuery = config.topic || "";
      if (config.subfields?.length) {
        searchQuery += " " + config.subfields.slice(0, 2).join(" ");
      }

      // skipEmbeddings: true to save CPU time on CF Workers (avoids Ollama calls + O(n²) cosine sim)
      const [searchResults, webResults] = await Promise.all([
        searchPapers(searchQuery, 20, { skipEmbeddings: true }).catch((err) => {
          console.error(`[process-next] searchPapers failed:`, err);
          return [] as RawPaper[];
        }),
        webSearch(searchQuery, 15).catch((err) => {
          console.error(`[process-next] webSearch failed:`, err);
          return [] as {
            title: string;
            url: string;
            snippet: string;
            engine: string;
          }[];
        }),
      ]);

      academicPapers = searchResults;

      // Convert web results to RawPaper format
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

      console.log(
        `[process-next] Search complete: ${academicPapers.length} academic, ${webPapersList.length} web`,
      );
    }

    // Merge PDF papers based on sourceMode
    if (config.sourceMode === "include") {
      academicPapers = [...pdfPapers, ...academicPapers];
    } else if (config.sourceMode === "only_sources") {
      academicPapers = pdfPapers;
    }

    // Sort by citation count
    academicPapers.sort(
      (a, b) => (b.citationCount || 0) - (a.citationCount || 0),
    );

    // Build final list: up to 12 academic + fill with web
    const targetAcademic = Math.min(academicPapers.length, 12);
    const targetWeb = Math.min(webPapersList.length, 12 - targetAcademic);

    const academicTitles = new Set(
      academicPapers.slice(0, targetAcademic).map((p) => p.title.toLowerCase()),
    );
    const dedupedWeb = webPapersList.filter(
      (w) => !academicTitles.has(w.title.toLowerCase()),
    );

    const allPapers = [
      ...academicPapers.slice(0, targetAcademic),
      ...dedupedWeb.slice(0, targetWeb),
    ];

    // Strip embeddings from storage
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const papersForStorage = allPapers.map(({ embedding, ...rest }) => rest);

    // Transition to process phase
    const processData: RawResultsProcess = {
      phase: "process",
      papers: papersForStorage,
      nextIndex: 0,
      config: {
        ...config,
        pdfContextText: pdfContextText || undefined,
      },
    };

    const total = papersForStorage.length;
    await db
      .update(scrolls)
      .set({
        rawResults: JSON.stringify(processData),
        progress: JSON.stringify({
          step: "processing",
          papersProcessed: 0,
          total,
        }),
        ...(hasPdfs ? { pdfKeys: JSON.stringify(config.pdfKeys) } : {}),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(
      `[process-next] Search phase complete. ${total} papers ready for processing.`,
    );

    return Response.json({
      status: "generating",
      progress: { step: "processing", papersProcessed: 0, total },
      done: false,
    });
  } catch (err) {
    console.error(`[process-next] Search phase failed:`, err);

    try {
      await db
        .update(scrolls)
        .set({
          status: "error",
          progress: JSON.stringify({
            step: "error",
            message: err instanceof Error ? err.message : "Search failed",
          }),
        })
        .where(eq(scrolls.id, scrollId));
    } catch {
      // ignore
    }

    return Response.json({
      status: "error",
      progress: {
        step: "error",
        message: err instanceof Error ? err.message : "Search failed",
      },
      done: true,
    });
  }
}

// ─── Phase: Process ──────────────────────────────────────────────────────────

async function handleProcessPhase(
  scrollId: string,
  scroll: { title: string; rawResults: string | null },
  rawData: RawResultsProcess,
) {
  const { papers: rawPapers, config } = rawData;
  const nextIndex = rawData.nextIndex || 0;
  const total = rawPapers.length;

  applyProviderConfig(config);

  // All papers processed → finalize
  if (nextIndex >= total) {
    return await finalizeScroll(scrollId, scroll, rawData);
  }

  // Process next paper
  const raw = rawPapers[nextIndex];
  console.log(
    `[process-next] Processing paper ${nextIndex + 1}/${total}: "${raw.title?.slice(0, 60)}"`,
  );

  try {
    const contextPrefix =
      config.sourceMode === "context_only" && config.pdfContextText
        ? `[User's reference material for context: ${config.pdfContextText.slice(0, 1500)}]\n\n`
        : "";

    const abstractForSynthesis = (raw.abstract || "").slice(0, 2000);

    const [synthesis, apaCitation] = await Promise.all([
      generateSynthesis(
        raw.title,
        contextPrefix + abstractForSynthesis,
        raw.authors || [],
      ),
      generateApaCitation(
        raw.title,
        raw.authors || [],
        raw.year || 0,
        raw.venue || "",
        raw.doi || "",
      ),
    ]);

    const isWeb = raw.source === "web";
    const credibilityScore = isWeb
      ? 40
      : computeCredibilityScore({
          citationCount: raw.citationCount || 0,
          venue: raw.venue || "",
          year: raw.year || 0,
        });

    await db.insert(papers).values({
      scrollId,
      externalId: raw.id,
      title: raw.title,
      authors: JSON.stringify(raw.authors || []),
      journal: raw.venue || (isWeb ? "Web Source" : "Academic Publication"),
      year: raw.year || new Date().getFullYear(),
      doi: raw.doi || "",
      peerReviewed: !!raw.venue && raw.source !== "pdf_upload" && !isWeb,
      synthesis,
      credibilityScore,
      citationCount: raw.citationCount || 0,
      commentCount: 0,
      apaCitation,
      isUserUpload: raw.source === "pdf_upload",
    });

    const newIndex = nextIndex + 1;
    rawData.nextIndex = newIndex;

    const progress = {
      step: newIndex >= total ? "exporting" : "processing",
      papersProcessed: newIndex,
      total,
    };

    await db
      .update(scrolls)
      .set({
        rawResults: JSON.stringify(rawData),
        paperCount: newIndex,
        progress: JSON.stringify(progress),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(`[process-next] Paper ${newIndex}/${total} saved OK`);

    return Response.json({
      status: "generating",
      progress,
      done: false,
    });
  } catch (err) {
    console.error(
      `[process-next] Failed to process paper "${raw.title}":`,
      err,
    );

    // Skip this paper and advance so we don't get stuck
    rawData.nextIndex = nextIndex + 1;

    const progress = {
      step: "processing",
      papersProcessed: nextIndex + 1,
      total,
      debug: `skipped: ${err instanceof Error ? err.message : "error"}`,
    };

    try {
      await db
        .update(scrolls)
        .set({
          rawResults: JSON.stringify(rawData),
          progress: JSON.stringify(progress),
        })
        .where(eq(scrolls.id, scrollId));
    } catch {
      // DB update failed — client will retry
    }

    return Response.json({
      status: "generating",
      progress,
      done: false,
    });
  }
}

// ─── Finalize ────────────────────────────────────────────────────────────────

async function finalizeScroll(
  scrollId: string,
  scroll: { title: string; rawResults: string | null },
  rawData: RawResultsProcess,
) {
  console.log(`[process-next] Finalizing scroll ${scrollId}`);

  const effectiveTopic = rawData.config.topic || scroll.title;
  const subfields = rawData.config.subfields;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(papers)
      .where(eq(papers.scrollId, scrollId));

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
          "Modern empirical studies (2000–2015)",
          "Recent cutting-edge research (2015+)",
          "A mix of all eras",
        ]),
      },
      {
        scrollId,
        type: "open-ended",
        question: "What specific research question are you trying to answer?",
      },
    ]);

    // Mark complete, clear rawResults
    await db
      .update(scrolls)
      .set({
        status: "complete",
        progress: null,
        rawResults: null,
        paperCount: Number(count),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(
      `[process-next] Scroll ${scrollId} finalized with ${count} papers`,
    );

    // Best-effort export outline
    try {
      await generateAndSaveExportOutline(scrollId, effectiveTopic);
    } catch {
      // nice-to-have
    }

    return Response.json({ status: "complete", progress: null, done: true });
  } catch (err) {
    console.error(`[process-next] Finalization failed:`, err);

    try {
      await db
        .update(scrolls)
        .set({ status: "complete", progress: null, rawResults: null })
        .where(eq(scrolls.id, scrollId));
    } catch {
      // last resort
    }

    return Response.json({ status: "complete", progress: null, done: true });
  }
}

// ─── Export outline helper ───────────────────────────────────────────────────

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
        const parsed = JSON.parse(jsonMatch[0]) as {
          themes: ExportTheme[];
        };
        exportOutline = parsed.themes || fallbackOutline();
      } catch {
        // malformed JSON
      }
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

// ─── Progress helper ─────────────────────────────────────────────────────────

async function updateProgress(
  scrollId: string,
  step: string,
  extra: Record<string, number | string> = {},
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
