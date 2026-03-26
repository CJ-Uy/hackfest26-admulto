import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  generateOverallSummary,
  generatePerPaperSummary,
  generateThemedExport,
  generateLiteratureReview,
} from "@/lib/ollama";
import { computeEngagementScores } from "@/lib/engagement-scoring";

export async function POST(req: NextRequest) {
  const { scrollId, mode } = (await req.json()) as {
    scrollId: string;
    mode: "with-summaries" | "themed" | "literature-review";
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
    } else if (mode === "literature-review") {
      // Mode 4: Behavior-aware literature review
      const scoredPapers = await computeEngagementScores(scrollId);
      const litReview = await generateLiteratureReview(scoredPapers);
      return NextResponse.json(litReview);
    } else {
      // Mode 3: Themed grouping with summaries
      const parsed = await generateThemedExport(papersData);
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
