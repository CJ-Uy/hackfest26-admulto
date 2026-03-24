import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
  generateSocialComments,
  setModels,
  configureProvider,
} from "@/lib/ollama";
import { db } from "@/lib/db";
import { scrolls, papers, comments, polls } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import type { RawPaper } from "@/lib/paper-search";
import type { ExportTheme } from "@/lib/types";

interface RawResultsData {
  papers: RawPaper[];
  nextIndex: number;
  config: {
    provider?: string;
    ollamaUrl?: string;
    fastModel?: string;
    smartModel?: string;
    topic?: string;
    subfields?: string[];
    sourceMode?: string;
    pdfContextText?: string;
  };
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

/**
 * Step 2 of multi-step feed generation.
 * Each call processes ONE paper (synthesis + citation + DB insert).
 * The client calls this repeatedly until all papers are processed.
 *
 * When all papers are done, this endpoint finalizes the scroll
 * (inserts polls, marks complete).
 *
 * Each invocation uses ~5-10 subrequests, well under CF Workers' 1000 limit.
 */
export async function POST(req: Request) {
  const { scrollId } = (await req.json()) as { scrollId: string };

  if (!scrollId) {
    return Response.json({ error: "scrollId required" }, { status: 400 });
  }

  // Read scroll
  const scroll = await db.query.scrolls.findFirst({
    where: eq(scrolls.id, scrollId),
  });

  if (!scroll) {
    return Response.json({ error: "Scroll not found" }, { status: 404 });
  }

  // Already done
  if (scroll.status === "complete") {
    return Response.json({ status: "complete", progress: null, done: true });
  }
  if (scroll.status === "error") {
    const progress = scroll.progress ? JSON.parse(scroll.progress) : null;
    return Response.json({ status: "error", progress, done: true });
  }

  // No raw results — nothing to process
  if (!scroll.rawResults) {
    return Response.json({
      status: scroll.status,
      progress: scroll.progress ? JSON.parse(scroll.progress) : null,
      done: scroll.status !== "generating",
    });
  }

  const rawData = JSON.parse(scroll.rawResults) as RawResultsData;
  const { papers: rawPapers, config } = rawData;
  const nextIndex = rawData.nextIndex || 0;
  const total = rawPapers.length;

  // Configure AI provider for this request
  setModels(config.fastModel, config.smartModel);
  if (config.provider) {
    configureProvider(
      config.provider as "ollama" | "cloudflare",
      config.ollamaUrl,
    );
  }

  // ── All papers processed → finalize ──
  if (nextIndex >= total) {
    return await finalizeScroll(scrollId, scroll, rawData);
  }

  // ── Process next paper ──
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

    // Advance index
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

    // If this was the last paper, finalize on the NEXT call
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

    // Skip this paper and advance index so we don't get stuck
    rawData.nextIndex = nextIndex + 1;

    const progress = {
      step: "processing",
      papersProcessed: nextIndex + 1,
      total,
      debug: `skipped paper ${nextIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`,
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
      // DB update failed too — client will retry
    }

    return Response.json({
      status: "generating",
      progress,
      done: false,
    });
  }
}

/** Finalize scroll: insert polls, mark complete, clean up rawResults. */
async function finalizeScroll(
  scrollId: string,
  scroll: { title: string; rawResults: string | null },
  rawData: RawResultsData,
) {
  console.log(`[process-next] Finalizing scroll ${scrollId}`);

  const effectiveTopic = rawData.config.topic || scroll.title;
  const subfields = rawData.config.subfields;

  try {
    // Count actual papers in DB
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

    // Best-effort: generate export outline (non-blocking, will fail gracefully)
    try {
      await generateAndSaveExportOutline(scrollId, effectiveTopic);
    } catch {
      // Export outline is nice-to-have — scroll works without it
    }

    return Response.json({ status: "complete", progress: null, done: true });
  } catch (err) {
    console.error(`[process-next] Finalization failed:`, err);

    // Still try to mark complete even if polls fail
    try {
      await db
        .update(scrolls)
        .set({ status: "complete", progress: null, rawResults: null })
        .where(eq(scrolls.id, scrollId));
    } catch {
      // Last resort
    }

    return Response.json({ status: "complete", progress: null, done: true });
  }
}

/** Best-effort export outline generation. */
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
