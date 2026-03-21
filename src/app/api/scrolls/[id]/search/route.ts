import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { safeEmbed, cosineSimilarity } from "@/lib/embeddings";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scrollId } = await params;
  const url = new URL(req.url);
  const query = url.searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  // Embed the search query
  const queryEmbedding = await safeEmbed(query);

  // Load all papers for this scroll
  const scrollPapers = await db
    .select()
    .from(papers)
    .where(eq(papers.scrollId, scrollId));

  if (scrollPapers.length === 0) {
    return Response.json({ results: [] });
  }

  if (!queryEmbedding) {
    // Fallback: simple substring search
    const lowerQuery = query.toLowerCase();
    const results = scrollPapers
      .filter(
        (p) =>
          p.title.toLowerCase().includes(lowerQuery) ||
          p.synthesis.toLowerCase().includes(lowerQuery),
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        synthesis: p.synthesis,
        authors: JSON.parse(p.authors),
        year: p.year,
        score: 1,
      }));

    return Response.json({ results });
  }

  // Compute similarity for each paper that has an embedding
  const scored = scrollPapers
    .map((p) => {
      const embedding = p.embedding ? (JSON.parse(p.embedding) as number[]) : null;
      const score = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
      return {
        id: p.id,
        title: p.title,
        synthesis: p.synthesis,
        authors: JSON.parse(p.authors),
        year: p.year,
        credibilityScore: p.credibilityScore,
        citationCount: p.citationCount,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return Response.json({ results: scored });
}
