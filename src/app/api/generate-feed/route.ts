import { generateSynthesis, generateApaCitation, generateExportOutline } from "@/lib/ollama";
import { verifyCard } from "@/lib/grounding";
import { webSearch } from "@/lib/search";
import { db } from "@/lib/db";
import type { Paper, ExportTheme } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";
const S2_API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPapersWithRetry(
  query: string,
  limit = 15,
  maxRetries = 2
): Promise<AnyRecord[]> {
  // Truncate query to avoid overly long searches that S2 rejects
  const trimmedQuery = query.slice(0, 200);

  const params = new URLSearchParams({
    query: trimmedQuery,
    limit: String(limit),
    fields:
      "title,abstract,url,year,citationCount,isOpenAccess,authors,venue,externalIds,journal",
  });

  const headers: Record<string, string> = {};
  if (S2_API_KEY) {
    headers["x-api-key"] = S2_API_KEY;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Longer backoff: 5s, 15s — S2 needs time to cool down
      const delay = attempt === 1 ? 5000 : 15000;
      console.log(`S2 retry attempt ${attempt}, waiting ${delay}ms...`);
      await sleep(delay);
    }

    try {
      const res = await fetch(`${S2_API}?${params}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json()) as AnyRecord;
        return (data.data as AnyRecord[]) || [];
      }

      if (res.status === 429) {
        console.warn(`S2 rate limited (429), attempt ${attempt + 1}/${maxRetries + 1}`);
        if (attempt === maxRetries) {
          console.warn("S2 rate limit exhausted, will supplement with web search");
          return [];
        }
        continue;
      }

      // Non-retryable error
      console.warn(`Semantic Scholar returned ${res.status}, will supplement with web search`);
      return [];
    } catch (err) {
      console.warn(`S2 request failed (attempt ${attempt + 1}):`, err);
      if (attempt === maxRetries) return [];
    }
  }

  return [];
}

function computeCredibilityScore(paper: AnyRecord): number {
  let score = 50;

  const citations = (paper.citationCount as number) || 0;
  if (citations > 10000) score += 30;
  else if (citations > 1000) score += 25;
  else if (citations > 100) score += 20;
  else if (citations > 10) score += 10;
  else if (citations > 0) score += 5;

  const venue =
    (paper.venue as string) || (paper.journal?.name as string) || "";
  if (venue) score += 15;

  const year = paper.year as number;
  const currentYear = new Date().getFullYear();
  if (year && currentYear - year <= 5) score += 5;
  else if (year && currentYear - year <= 15) score += 3;

  return Math.min(score, 99);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    topic: string;
    description?: string;
    subfields?: string[];
    mode?: string;
  };

  const { topic, description, subfields, mode } = body;

  // Use just the topic for S2 search (short, focused query)
  // Subfields can be appended for specificity but keep it concise
  let searchQuery = topic;
  if (subfields?.length) {
    searchQuery += " " + subfields.slice(0, 2).join(" ");
  }

  try {
    // 1. Fetch papers from Semantic Scholar with retry
    const rawPapers = await searchPapersWithRetry(searchQuery, 20);

    const papersWithAbstracts = rawPapers.filter(
      (p) => p.abstract && (p.abstract as string).length > 50
    );

    // 2. Process each paper: synthesize, verify, format
    const processedPapers: Paper[] = [];

    // -- S2 path: process academic papers --
    for (const raw of papersWithAbstracts) {
      if (processedPapers.length >= 12) break;

      const authors =
        (raw.authors as AnyRecord[])?.map((a) => a.name as string) || [];
      const title = raw.title as string;
      const abstract = raw.abstract as string;
      const year = (raw.year as number) || 0;
      const venue =
        (raw.venue as string) ||
        (raw.journal as AnyRecord)?.name ||
        "Academic Publication";
      const doi = (raw.externalIds as AnyRecord)?.DOI || "";
      const citationCount = (raw.citationCount as number) || 0;

      try {
        const synthesis = await generateSynthesis(title, abstract, authors);

        let verified = true;
        try {
          const verification = (await verifyCard(
            abstract,
            synthesis
          )) as AnyRecord;
          verified = verification.card_verified !== false;
        } catch {
          verified = true;
        }

        if (!verified) continue;

        const apaCitation = await generateApaCitation(
          title,
          authors,
          year,
          venue as string,
          doi as string
        );

        const credibilityScore = computeCredibilityScore(raw);

        processedPapers.push({
          id: (raw.paperId as string) || `p-${processedPapers.length}`,
          title,
          authors,
          journal: venue as string,
          year,
          doi: doi as string,
          peerReviewed: !!venue,
          synthesis,
          credibilityScore,
          citationCount,
          commentCount: 0,
          apaCitation,
        });
      } catch (err) {
        console.error(`Failed to process paper "${title}":`, err);
        continue;
      }
    }

    // -- Web search supplement: fill remaining slots if S2 returned few results --
    if (processedPapers.length < 6) {
      console.log(
        `Only ${processedPapers.length} S2 results, supplementing with web search`
      );
      let webResults: { title: string; url: string; snippet: string; engine: string }[] = [];
      try {
        webResults = await webSearch(searchQuery, 15);
      } catch (err) {
        console.error("Web search also failed:", err);
      }

      // Avoid duplicates by title
      const existingTitles = new Set(
        processedPapers.map((p) => p.title.toLowerCase())
      );

      for (const result of webResults) {
        if (processedPapers.length >= 12) break;
        if (!result.snippet || result.snippet.length < 20) continue;
        if (existingTitles.has(result.title.toLowerCase())) continue;

        const title = result.title;
        const snippet = result.snippet;

        try {
          const synthesis = await generateSynthesis(title, snippet, []);

          const apaCitation = await generateApaCitation(
            title,
            [],
            new Date().getFullYear(),
            result.engine || "Web",
            result.url
          );

          processedPapers.push({
            id: `web-${processedPapers.length}`,
            title,
            authors: [],
            journal: result.engine || "Web Source",
            year: new Date().getFullYear(),
            doi: result.url,
            peerReviewed: false,
            synthesis,
            credibilityScore: 40,
            citationCount: 0,
            commentCount: 0,
            apaCitation,
          });
        } catch (err) {
          console.error(`Failed to process web result "${title}":`, err);
          continue;
        }
      }
    }

    // 3. Generate export outline from processed papers
    let exportOutline: ExportTheme[] = [];
    if (processedPapers.length > 0) {
      try {
        const outlineInput = processedPapers.map((p) => ({
          title: p.title,
          authors: p.authors.join(", "),
          year: p.year,
          synthesis: p.synthesis,
          apaCitation: p.apaCitation,
        }));

        const outlineJson = await generateExportOutline(outlineInput);
        const jsonMatch = outlineJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            themes: ExportTheme[];
          };
          exportOutline = parsed.themes || [];
        }
      } catch (err) {
        console.error("Failed to generate export outline:", err);
        exportOutline = [
          {
            title: topic,
            summary: `Research papers on ${topic}.`,
            sources: processedPapers.map((p) => ({
              title: p.title,
              authors: p.authors.join(", "),
              year: p.year,
              keyFinding: p.synthesis.split(".")[0] + ".",
              apaCitation: p.apaCitation,
            })),
          },
        ];
      }
    }

    // 4. Persist to database
    const scroll = await db.scroll.create({
      data: {
        title: topic,
        description:
          description || `Exploring research on ${topic}.`,
        mode: mode === "citationFinder" ? "citation-finder" : "brainstorm",
        date: new Date().toISOString().split("T")[0],
        paperCount: processedPapers.length,
        exportData: JSON.stringify(exportOutline),
        papers: {
          create: processedPapers.map((p) => ({
            externalId: p.id,
            title: p.title,
            authors: JSON.stringify(p.authors),
            journal: p.journal,
            year: p.year,
            doi: p.doi,
            peerReviewed: p.peerReviewed,
            synthesis: p.synthesis,
            credibilityScore: p.credibilityScore,
            citationCount: p.citationCount,
            commentCount: p.commentCount,
            apaCitation: p.apaCitation,
          })),
        },
      },
      include: { papers: true },
    });

    // 5. Map DB records back to API response types
    const responsePapers: Paper[] = scroll.papers.map((p) => ({
      id: p.id,
      title: p.title,
      authors: JSON.parse(p.authors) as string[],
      journal: p.journal,
      year: p.year,
      doi: p.doi,
      peerReviewed: p.peerReviewed,
      synthesis: p.synthesis,
      credibilityScore: p.credibilityScore,
      citationCount: p.citationCount,
      commentCount: p.commentCount,
      apaCitation: p.apaCitation,
    }));

    const responseScroll = {
      id: scroll.id,
      title: scroll.title,
      description: scroll.description,
      date: scroll.date,
      paperCount: scroll.paperCount,
      mode: scroll.mode as "brainstorm" | "citation-finder",
    };

    return Response.json({
      papers: responsePapers,
      exportOutline,
      scroll: responseScroll,
      topic,
    });
  } catch (err) {
    console.error("Feed generation failed:", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Feed generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
