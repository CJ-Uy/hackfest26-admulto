import { after } from "next/server";
import {
  generateSynthesis,
  generateApaCitation,
  generateExportOutline,
} from "@/lib/ollama";
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
): Promise<AnyRecord[]> {
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

  // Single attempt + 1 fast retry (2s backoff) — fail fast to web search
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (attempt > 0) {
      console.log("S2 retry attempt 1, waiting 2s...");
      await sleep(2000);
    }

    try {
      const res = await fetch(`${S2_API}?${params}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as AnyRecord;
        return (data.data as AnyRecord[]) || [];
      }

      if (res.status === 429) {
        console.warn(`S2 rate limited (429), attempt ${attempt + 1}/2`);
        if (attempt === 1) {
          console.warn("S2 rate limit exhausted, falling back to web search");
          return [];
        }
        continue;
      }

      console.warn(
        `Semantic Scholar returned ${res.status}, falling back to web search`,
      );
      return [];
    } catch (err) {
      console.warn(`S2 request failed (attempt ${attempt + 1}):`, err);
      if (attempt === 1) return [];
    }
  }

  return [];
}

const CONCURRENCY = 4;

async function processInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  maxResults: number,
): Promise<R[]> {
  const results: R[] = [];
  for (
    let i = 0;
    i < items.length && results.length < maxResults;
    i += CONCURRENCY
  ) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (results.length >= maxResults) break;
      if (r.status === "fulfilled" && r.value !== null) {
        results.push(r.value);
      }
    }
  }
  return results;
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

async function updateProgress(
  scrollId: string,
  step: string,
  extra: Record<string, number> = {},
) {
  await db.scroll.update({
    where: { id: scrollId },
    data: { progress: JSON.stringify({ step, ...extra }) },
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    topic: string;
    description?: string;
    subfields?: string[];
    mode?: string;
  };

  const { topic, description, subfields, mode } = body;

  try {
    // Create scroll record immediately with "generating" status
    const scroll = await db.scroll.create({
      data: {
        title: topic,
        description: description || `Exploring research on ${topic}.`,
        mode: mode === "citationFinder" ? "citation-finder" : "brainstorm",
        date: new Date().toISOString().split("T")[0],
        paperCount: 0,
        status: "generating",
        progress: JSON.stringify({ step: "searching" }),
      },
    });

    const scrollId = scroll.id;

    // Run heavy processing in background after returning response
    after(async () => {
      try {
        let searchQuery = topic;
        if (subfields?.length) {
          searchQuery += " " + subfields.slice(0, 2).join(" ");
        }

        // 1. Fetch S2 papers and web results in parallel
        const [rawPapers, webResults] = await Promise.all([
          searchPapersWithRetry(searchQuery, 20),
          webSearch(searchQuery, 8).catch((err) => {
            console.error("Web search failed:", err);
            return [] as {
              title: string;
              url: string;
              snippet: string;
              engine: string;
            }[];
          }),
        ]);

        const papersWithAbstracts = rawPapers.filter(
          (p) => p.abstract && (p.abstract as string).length > 50,
        );

        const total = Math.min(papersWithAbstracts.length, 12);
        await updateProgress(scrollId, "processing", {
          papersProcessed: 0,
          total,
        });

        // 2. Process S2 papers in parallel batches with progress updates
        let papersProcessed = 0;

        const processPaper = async (raw: AnyRecord): Promise<Paper | null> => {
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
                synthesis,
              )) as AnyRecord;
              verified = verification.card_verified !== false;
            } catch {
              verified = true;
            }

            if (!verified) return null;

            const apaCitation = await generateApaCitation(
              title,
              authors,
              year,
              venue as string,
              doi as string,
            );
            const credibilityScore = computeCredibilityScore(raw);

            return {
              id:
                (raw.paperId as string) ||
                `p-${Math.random().toString(36).slice(2)}`,
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
            };
          } catch (err) {
            console.error(`Failed to process paper "${title}":`, err);
            return null;
          }
        };

        // Process with progress tracking per batch
        const processedPapers: Paper[] = [];
        for (
          let i = 0;
          i < papersWithAbstracts.length && processedPapers.length < 12;
          i += CONCURRENCY
        ) {
          const batch = papersWithAbstracts.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            batch.map(processPaper),
          );
          for (const r of batchResults) {
            if (processedPapers.length >= 12) break;
            if (r.status === "fulfilled" && r.value !== null) {
              processedPapers.push(r.value);
            }
          }
          papersProcessed = Math.min(i + CONCURRENCY, papersWithAbstracts.length);
          await updateProgress(scrollId, "processing", {
            papersProcessed: Math.min(papersProcessed, total),
            total,
          });
        }

        // 3. Supplement with web results if S2 yielded few papers
        if (processedPapers.length < 6) {
          console.log(
            `Only ${processedPapers.length} S2 results, supplementing with web search`,
          );

          const existingTitles = new Set(
            processedPapers.map((p) => p.title.toLowerCase()),
          );

          const eligibleWebResults = webResults.filter(
            (r) =>
              r.snippet &&
              r.snippet.length >= 20 &&
              !existingTitles.has(r.title.toLowerCase()),
          );

          const processWebResult = async (
            result: (typeof webResults)[number],
          ): Promise<Paper | null> => {
            try {
              const synthesis = await generateSynthesis(
                result.title,
                result.snippet,
                [],
              );
              const apaCitation = await generateApaCitation(
                result.title,
                [],
                new Date().getFullYear(),
                result.engine || "Web",
                result.url,
              );

              return {
                id: `web-${Math.random().toString(36).slice(2)}`,
                title: result.title,
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
              };
            } catch (err) {
              console.error(
                `Failed to process web result "${result.title}":`,
                err,
              );
              return null;
            }
          };

          const remaining = 12 - processedPapers.length;
          const webPapers = await processInBatches(
            eligibleWebResults,
            processWebResult,
            remaining,
          );
          processedPapers.push(...webPapers);
        }

        // 4. Generate export outline
        await updateProgress(scrollId, "exporting");

        const fallbackOutline = (): ExportTheme[] => [
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
              try {
                const parsed = JSON.parse(jsonMatch[0]) as {
                  themes: ExportTheme[];
                };
                exportOutline = parsed.themes || [];
              } catch {
                console.warn(
                  "Export outline JSON was malformed, using fallback",
                );
                exportOutline = fallbackOutline();
              }
            } else {
              exportOutline = fallbackOutline();
            }
          } catch (err) {
            console.error("Failed to generate export outline:", err);
            exportOutline = fallbackOutline();
          }
        }

        // 5. Persist papers, polls, and mark as complete
        await db.scroll.update({
          where: { id: scrollId },
          data: {
            paperCount: processedPapers.length,
            exportData: JSON.stringify(exportOutline),
            status: "complete",
            progress: null,
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
            polls: {
              create: [
                {
                  type: "multiple-choice",
                  question: `Which aspect of "${topic}" interests you most?`,
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
                  type: "open-ended",
                  question:
                    "What specific research question are you trying to answer?",
                },
              ],
            },
          },
        });

        console.log(
          `Feed generation complete for scroll ${scrollId}: ${processedPapers.length} papers`,
        );
      } catch (err) {
        console.error(`Background feed generation failed for ${scrollId}:`, err);
        await db.scroll.update({
          where: { id: scrollId },
          data: {
            status: "error",
            progress: JSON.stringify({
              step: "error",
              message:
                err instanceof Error ? err.message : "Feed generation failed",
            }),
          },
        });
      }
    });

    // Return immediately with the scroll ID
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
