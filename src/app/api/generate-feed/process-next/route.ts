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
import { eq, sql, asc } from "drizzle-orm";
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

/** rawResults is now tiny — just phase + config + index. Papers live in the DB. */
interface RawResultsSearch {
  phase: "search";
  config: Config;
}

interface RawResultsProcess {
  phase: "process";
  total: number;
  processed: number;
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

// Placeholder used to identify papers that still need synthesis
const PENDING_SYNTHESIS = "__PENDING__";

// ─── Main endpoint ───────────────────────────────────────────────────────────

/**
 * Multi-step feed generation driver.
 * The client calls this repeatedly. Each call does one unit of work:
 *
 * Phase "search": Search APIs + insert papers with placeholder synthesis
 * Phase "process": Read ONE unprocessed paper, generate synthesis, update it
 * Finalize: Insert polls, mark complete
 *
 * rawResults is now <1KB (just config + counters). Papers live in the papers table.
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
  _scroll: { title: string },
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
      let searchQuery = config.topic || "";
      if (config.subfields?.length) {
        searchQuery += " " + config.subfields.slice(0, 2).join(" ");
      }

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

    const total = allPapers.length;

    // ── Insert papers into DB with placeholder synthesis ──
    // This means rawResults doesn't need to store paper data at all!
    if (total > 0) {
      await db.insert(papers).values(
        allPapers.map((p) => {
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
            // Store abstract temporarily in groundingData for synthesis generation
            groundingData: JSON.stringify({
              abstract: (p.abstract || "").slice(0, 2000),
            }),
          };
        }),
      );
    }

    // Transition to process phase — rawResults is now tiny (~200 bytes)
    const processData: RawResultsProcess = {
      phase: "process",
      total,
      processed: 0,
      config: {
        ...config,
        pdfContextText: pdfContextText || undefined,
      },
    };

    await db
      .update(scrolls)
      .set({
        rawResults: JSON.stringify(processData),
        paperCount: total,
        progress: JSON.stringify({
          step: "processing",
          papersProcessed: 0,
          total,
        }),
        ...(hasPdfs ? { pdfKeys: JSON.stringify(config.pdfKeys) } : {}),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(
      `[process-next] Search phase complete. ${total} papers inserted, ready for processing.`,
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
  const { config, total } = rawData;

  applyProviderConfig(config);

  // Find the next paper with placeholder synthesis
  const pendingPapers = await db
    .select()
    .from(papers)
    .where(eq(papers.scrollId, scrollId))
    .orderBy(asc(papers.id))
    .limit(100);

  const nextPaper = pendingPapers.find(
    (p) => p.synthesis === PENDING_SYNTHESIS,
  );

  // All papers processed → finalize
  if (!nextPaper) {
    return await finalizeScroll(scrollId, scroll, rawData);
  }

  const processed = pendingPapers.filter(
    (p) => p.synthesis !== PENDING_SYNTHESIS,
  ).length;

  console.log(
    `[process-next] Processing paper ${processed + 1}/${total}: "${nextPaper.title?.slice(0, 60)}"`,
  );

  try {
    const contextPrefix =
      config.sourceMode === "context_only" && config.pdfContextText
        ? `[User's reference material for context: ${config.pdfContextText.slice(0, 1500)}]\n\n`
        : "";

    // Recover abstract from groundingData where we stored it during search
    let abstract = "";
    if (nextPaper.groundingData) {
      try {
        const gd = JSON.parse(nextPaper.groundingData) as { abstract?: string };
        abstract = gd.abstract || "";
      } catch {
        // ignore
      }
    }

    const [synthesis, apaCitation] = await Promise.all([
      generateSynthesis(
        nextPaper.title,
        contextPrefix + abstract,
        JSON.parse(nextPaper.authors || "[]") as string[],
      ),
      generateApaCitation(
        nextPaper.title,
        JSON.parse(nextPaper.authors || "[]") as string[],
        nextPaper.year || 0,
        nextPaper.journal || "",
        nextPaper.doi || "",
      ),
    ]);

    // Update paper with real synthesis, clear the temp groundingData
    await db
      .update(papers)
      .set({
        synthesis,
        apaCitation,
        groundingData: null,
      })
      .where(eq(papers.id, nextPaper.id));

    const newProcessed = processed + 1;

    const progress = {
      step: newProcessed >= total ? "exporting" : "processing",
      papersProcessed: newProcessed,
      total,
    };

    // Update scroll progress — rawResults stays tiny
    rawData.processed = newProcessed;
    await db
      .update(scrolls)
      .set({
        rawResults: JSON.stringify(rawData),
        progress: JSON.stringify(progress),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(`[process-next] Paper ${newProcessed}/${total} processed OK`);

    return Response.json({
      status: "generating",
      progress,
      done: false,
    });
  } catch (err) {
    console.error(
      `[process-next] Failed to process paper "${nextPaper.title}":`,
      err,
    );

    // Mark this paper as skipped so we don't get stuck
    try {
      await db
        .update(papers)
        .set({
          synthesis: `[Summary unavailable for "${nextPaper.title}"]`,
          apaCitation: nextPaper.title,
          groundingData: null,
        })
        .where(eq(papers.id, nextPaper.id));
    } catch {
      // if even this fails, we'll skip on next iteration
    }

    const newProcessed = processed + 1;
    const progress = {
      step: "processing",
      papersProcessed: newProcessed,
      total,
      debug: `skipped: ${err instanceof Error ? err.message : "error"}`,
    };

    try {
      rawData.processed = newProcessed;
      await db
        .update(scrolls)
        .set({
          rawResults: JSON.stringify(rawData),
          progress: JSON.stringify(progress),
        })
        .where(eq(scrolls.id, scrollId));
    } catch {
      // client will retry
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
