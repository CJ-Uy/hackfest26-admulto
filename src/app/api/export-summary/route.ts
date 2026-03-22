import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  generateOverallSummary,
  generatePerPaperSummary,
  generateThemedExport,
} from "@/lib/ollama";

export async function POST(req: NextRequest) {
  const { scrollId, mode } = (await req.json()) as {
    scrollId: string;
    mode: "with-summaries" | "themed";
  };

  if (!scrollId || !mode) {
    return NextResponse.json(
      { error: "scrollId and mode are required" },
      { status: 400 },
    );
  }

  const scrollPapers = await db
    .select()
    .from(papers)
    .where(eq(papers.scrollId, scrollId));

  if (scrollPapers.length === 0) {
    return NextResponse.json({ error: "No papers found" }, { status: 404 });
  }

  const papersData = scrollPapers.map((p) => ({
    title: p.title,
    synthesis: p.synthesis,
    authors: JSON.parse(p.authors) as string[],
    year: p.year,
    apaCitation: p.apaCitation,
    doi: p.doi,
    citationCount: p.citationCount,
    credibilityScore: p.credibilityScore,
  }));

  try {
    if (mode === "with-summaries") {
      // Mode 2: Reference list with AI summary per-reference and overall
      const [overallSummary, ...perPaperSummaries] = await Promise.all([
        generateOverallSummary(papersData),
        ...papersData.map((p) => generatePerPaperSummary(p.title, p.synthesis)),
      ]);

      return NextResponse.json({
        overallSummary,
        papers: papersData.map((p, i) => ({
          ...p,
          aiSummary: perPaperSummaries[i],
        })),
      });
    } else {
      // Mode 3: Themed grouping with summaries
      const raw = await generateThemedExport(papersData);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse themed export");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        overallSummary: string;
        themes: Array<{
          title: string;
          summary: string;
          sources: Array<{
            title: string;
            authors: string;
            year: number;
            keyFinding: string;
            apaCitation: string;
          }>;
        }>;
      };

      return NextResponse.json(parsed);
    }
  } catch (err) {
    console.error("Export summary generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate export summaries" },
      { status: 500 },
    );
  }
}
