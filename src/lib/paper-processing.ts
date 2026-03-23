import {
  generateSynthesis,
  generateApaCitation,
  generateSocialComments,
  OLLAMA_CONCURRENCY,
  OLLAMA_COMMENT_CONCURRENCY as commentBatchSize,
} from "@/lib/ollama";
import { verifyCard, type GroundingResult } from "@/lib/grounding";
import { safeEmbedBatch, findSimilarPairs } from "@/lib/embeddings";
import type { Paper } from "@/lib/types";

const CONCURRENCY = OLLAMA_CONCURRENCY;

export function computeCredibilityScore(paper: {
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

export async function processInBatches<T, R>(
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

export interface RawAcademicPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number;
  venue: string;
  doi: string;
  citationCount: number;
  embedding?: number[];
}

export async function processAcademicPaper(
  raw: RawAcademicPaper,
): Promise<Paper | null> {
  try {
    const [synthesis, apaCitation] = await Promise.all([
      generateSynthesis(raw.title, raw.abstract, raw.authors),
      generateApaCitation(raw.title, raw.authors, raw.year, raw.venue, raw.doi),
    ]);

    let groundingData: GroundingResult | null = null;
    try {
      groundingData = await verifyCard(raw.abstract, synthesis);
    } catch {
      // verification service unavailable — continue
    }

    const credibilityScore = computeCredibilityScore({
      citationCount: raw.citationCount,
      venue: raw.venue,
      year: raw.year,
    });

    return {
      id: raw.id,
      title: raw.title,
      authors: raw.authors,
      journal: raw.venue,
      year: raw.year,
      doi: raw.doi,
      peerReviewed: !!raw.venue,
      synthesis,
      credibilityScore,
      citationCount: raw.citationCount,
      commentCount: 0,
      apaCitation,
      embedding: raw.embedding,
      groundingData,
    };
  } catch (err) {
    console.error(`Failed to process paper "${raw.title}":`, err);
    return null;
  }
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

export async function processWebResult(
  result: WebResult,
): Promise<Paper | null> {
  try {
    const [synthesis, apaCitation] = await Promise.all([
      generateSynthesis(result.title, result.snippet, []),
      generateApaCitation(
        result.title,
        [],
        new Date().getFullYear(),
        result.engine || "Web",
        result.url,
      ),
    ]);

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
    console.error(`Failed to process web result "${result.title}":`, err);
    return null;
  }
}

export type RawComment = {
  author: string;
  content: string;
  relationship: string;
};

export async function generateCommentsForPapers(
  processedPapers: Paper[],
): Promise<Map<number, RawComment[]>> {
  const rawComments = new Map<number, RawComment[]>();
  if (processedPapers.length < 2) return rawComments;

  // Build semantic similarity pairs for better comment matching
  let similarPairs: Map<
    number,
    Array<{ index: number; score: number }>
  > | null = null;

  // Use existing embeddings or generate new ones
  const existingEmbeddings = processedPapers.map((p) => p.embedding);
  const allHaveEmbeddings = existingEmbeddings.every((e) => !!e);

  if (allHaveEmbeddings) {
    similarPairs = findSimilarPairs(existingEmbeddings as number[][], 4);
  } else {
    // Try to embed papers that don't have embeddings
    const texts = processedPapers.map((p) => `${p.title}. ${p.synthesis}`);
    const embeddings = await safeEmbedBatch(texts);
    if (embeddings) {
      similarPairs = findSimilarPairs(embeddings, 4);
    }
  }

  for (let i = 0; i < processedPapers.length; i += commentBatchSize) {
    const batch = processedPapers.slice(i, i + commentBatchSize);
    const batchPromises = batch.map(async (paper, batchIdx) => {
      const paperIdx = i + batchIdx;

      // Pick commenters: semantically similar papers if available, else first 4
      let others;
      if (similarPairs && similarPairs.has(paperIdx)) {
        const similar = similarPairs.get(paperIdx)!;
        others = similar.map((s) => processedPapers[s.index]);
      } else {
        others = processedPapers
          .filter((_, idx) => idx !== paperIdx)
          .slice(0, 4);
      }

      try {
        const generatedComments = await generateSocialComments(
          {
            title: paper.title,
            synthesis: paper.synthesis,
            authors: paper.authors,
          },
          others.map((o) => ({
            title: o.title,
            synthesis: o.synthesis,
            authors: o.authors,
            year: o.year,
            citationCount: o.citationCount,
          })),
          3,
        );
        rawComments.set(paperIdx, generatedComments);
      } catch (err) {
        console.error(
          `Failed to generate comments for paper ${paperIdx}:`,
          err,
        );
      }
    });

    await Promise.all(batchPromises);
  }

  return rawComments;
}
