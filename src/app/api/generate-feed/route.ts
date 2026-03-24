import { searchPapers, type RawPaper } from "@/lib/paper-search";
import { webSearch } from "@/lib/search";
import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { AiProviderType } from "@/lib/ai-provider";
import { getPdf } from "@/lib/r2";
import { extractPdfContent, pdfToRawPaper } from "@/lib/pdf-extract";

/**
 * Step 1 of multi-step feed generation.
 * Creates the scroll, searches for papers, saves raw results to DB.
 * Returns the scroll ID immediately so the client can start driving
 * paper-by-paper processing via /api/generate-feed/process-next.
 *
 * This keeps each CF Worker invocation well under the 1000 subrequest limit.
 */
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

  const hasPdfs = pdfKeys && pdfKeys.length > 0;
  const effectiveSourceMode = hasPdfs ? sourceMode || "include" : undefined;
  const isOnlySources = effectiveSourceMode === "only_sources";

  if (!topic && !isOnlySources) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }

  try {
    const scrollTitle = topic || "Uploaded Sources";

    // Create scroll record immediately
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
        progress: JSON.stringify({ step: "queued" }),
      })
      .returning();

    const scrollId = scroll.id;
    console.log(
      `[generate-feed] Scroll created: ${scrollId}, topic: "${topic}"`,
    );

    // ── Extract PDFs if provided ──
    const pdfPapers: RawPaper[] = [];
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
          pdfContextText += `\n\n--- ${extracted.title} ---\n${extracted.text.slice(0, 2000)}`;
        } catch (err) {
          console.error(`Failed to extract PDF ${key}:`, err);
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

    // ── Search for papers ──
    let academicPapers: RawPaper[] = [];
    let webPapersList: RawPaper[] = [];

    if (!isOnlySources) {
      await updateProgress(scrollId, "searching");

      let searchQuery = topic || "";
      if (subfields?.length) {
        searchQuery += " " + subfields.slice(0, 2).join(" ");
      }

      const [searchResults, webResults] = await Promise.all([
        searchPapers(searchQuery, 20).catch((err) => {
          console.error(`[generate-feed] searchPapers failed:`, err);
          return [] as RawPaper[];
        }),
        webSearch(searchQuery, 15).catch((err) => {
          console.error(`[generate-feed] webSearch failed:`, err);
          return [] as {
            title: string;
            url: string;
            snippet: string;
            engine: string;
          }[];
        }),
      ]);

      academicPapers = searchResults;

      // Convert web results to RawPaper format for uniform processing
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
        `[generate-feed] Search complete: ${academicPapers.length} academic, ${webPapersList.length} web`,
      );
    }

    // Merge PDF papers based on sourceMode
    if (effectiveSourceMode === "include") {
      academicPapers = [...pdfPapers, ...academicPapers];
    } else if (effectiveSourceMode === "only_sources") {
      academicPapers = pdfPapers;
    }

    // Sort by citation count (simple ranking — embeddings already handled in searchPapers)
    academicPapers.sort(
      (a, b) => (b.citationCount || 0) - (a.citationCount || 0),
    );

    // Build final paper list: up to 12 academic, fill remaining with web
    const targetAcademic = Math.min(academicPapers.length, 12);
    const targetWeb = Math.min(webPapersList.length, 12 - targetAcademic);

    // Deduplicate web results against academic titles
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

    // Strip embeddings to reduce storage size
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const papersForStorage = allPapers.map(({ embedding, ...rest }) => rest);

    // Save raw results + config for process-next to use
    const rawResults = {
      papers: papersForStorage,
      nextIndex: 0,
      config: {
        provider: body.provider || "ollama",
        ollamaUrl: body.ollamaUrl,
        fastModel: body.fastModel,
        smartModel: body.smartModel,
        topic: topic || scroll.title,
        subfields: subfields,
        sourceMode: effectiveSourceMode,
        pdfContextText: pdfContextText || undefined,
      },
    };

    await db
      .update(scrolls)
      .set({
        rawResults: JSON.stringify(rawResults),
        progress: JSON.stringify({
          step: "processing",
          papersProcessed: 0,
          total: allPapers.length,
        }),
        ...(hasPdfs ? { pdfKeys: JSON.stringify(pdfKeys) } : {}),
      })
      .where(eq(scrolls.id, scrollId));

    console.log(
      `[generate-feed] Saved ${allPapers.length} raw papers for processing`,
    );

    return Response.json({ scroll: { id: scrollId } });
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

/** Best-effort progress update — never throws. */
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
