import { db } from "@/lib/db";
import { scrolls } from "@/lib/schema";
import type { AiProviderType } from "@/lib/ai-provider";

/**
 * Step 1 of multi-step feed generation.
 * ONLY creates the scroll record and returns the ID.
 * All heavy work (search, synthesis) is done by process-next.
 *
 * This must stay under ~1ms CPU to survive CF Workers free tier (10ms limit).
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

    // Store config for process-next to use
    const rawResults = {
      phase: "search" as const,
      config: {
        provider: body.provider || "ollama",
        ollamaUrl: body.ollamaUrl,
        fastModel: body.fastModel,
        smartModel: body.smartModel,
        topic: topic,
        description: description,
        subfields: subfields,
        sourceMode: effectiveSourceMode,
        pdfKeys: pdfKeys,
      },
    };

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
        rawResults: JSON.stringify(rawResults),
      })
      .returning();

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
