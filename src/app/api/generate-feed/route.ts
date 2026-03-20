import { webSearch } from "@/lib/search";
import { generateSynthesis } from "@/lib/ollama";
import { verifyCard } from "@/lib/grounding";

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";

async function searchPapers(query: string, limit = 10) {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "title,abstract,url,year,citationCount,isOpenAccess,authors,tldr",
  });
  const res = await fetch(`${S2_API}?${params}`);
  const data = (await res.json()) as Record<string, unknown>;
  return (data.data as Record<string, unknown>[]) || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export async function POST(req: Request) {
  const { topic } = (await req.json()) as { topic: string };

  // 1️⃣ FETCH — Get papers and web results in parallel
  const [papers, webResults] = await Promise.all([
    searchPapers(topic, 15),
    webSearch(topic, 10),
  ]);

  const cards: AnyRecord[] = [];

  // 2️⃣ Process academic papers
  for (const paper of papers as AnyRecord[]) {
    if (cards.length >= 10) break;
    if (!paper.abstract) continue;

    const synthesis = await generateSynthesis(
      paper.title as string,
      paper.abstract as string,
      (paper.authors as AnyRecord[])?.map((a) => a.name as string) || [],
    );

    const verification = (await verifyCard(paper.abstract as string, synthesis)) as AnyRecord;

    if (verification.card_verified) {
      cards.push({
        id: paper.paperId,
        type: "paper" as const,
        title: paper.title,
        synthesis,
        authors: (paper.authors as AnyRecord[])?.map((a) => a.name as string) || [],
        year: paper.year,
        citations: paper.citationCount,
        isOpenAccess: paper.isOpenAccess,
        url: paper.url,
        verification,
      });
    }
  }

  // 3️⃣ Include web search results
  const webCards = (webResults as AnyRecord[]).map((r, i: number) => ({
    id: `web-${i}`,
    type: "web" as const,
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    engine: r.engine,
  }));

  return Response.json({ cards, webCards, topic });
}
