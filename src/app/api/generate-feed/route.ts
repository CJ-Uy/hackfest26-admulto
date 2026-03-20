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
  const data = await res.json();
  return data.data || [];
}

export async function POST(req: Request) {
  const { topic } = await req.json();

  // 1️⃣ FETCH — Get papers and web results in parallel
  const [papers, webResults] = await Promise.all([
    searchPapers(topic, 15),
    webSearch(topic, 10),
  ]);

  const cards = [];

  // 2️⃣ Process academic papers
  for (const paper of papers) {
    if (cards.length >= 10) break;
    if (!paper.abstract) continue;

    const synthesis = await generateSynthesis(
      paper.title,
      paper.abstract,
      paper.authors?.map((a: any) => a.name) || [],
    );

    const verification = await verifyCard(paper.abstract, synthesis);

    if (verification.card_verified) {
      cards.push({
        id: paper.paperId,
        type: "paper" as const,
        title: paper.title,
        synthesis,
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        citations: paper.citationCount,
        isOpenAccess: paper.isOpenAccess,
        url: paper.url,
        verification,
      });
    }
  }

  // 3️⃣ Include web search results
  const webCards = webResults.map((r: any, i: number) => ({
    id: `web-${i}`,
    type: "web" as const,
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    engine: r.engine,
  }));

  return Response.json({ cards, webCards, topic });
}
