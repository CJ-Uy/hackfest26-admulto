/**
 * Multi-source academic paper search.
 * Searches OpenAlex (primary), CrossRef (secondary), and Semantic Scholar (tertiary).
 * All APIs are free and require no keys for basic usage.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/**
 * Return true only for URLs that are likely to serve an actual PDF binary,
 * not DOI redirect pages or HTML landing pages.
 */
function isPdfUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    // Direct PDF file extension
    if (path.endsWith(".pdf")) return true;
    // arXiv PDF paths: /pdf/<id> or /pdf/<id>v<n>
    if (u.hostname.includes("arxiv.org") && path.startsWith("/pdf/")) return true;
    // PubMed Central direct PDF
    if (u.hostname.includes("ncbi.nlm.nih.gov") && path.includes("/pdf/")) return true;
    // Europe PMC
    if (u.hostname.includes("europepmc.org") && path.includes("/pdf/")) return true;
    // bioRxiv / medRxiv full-text PDFs (e.g. /content/10.1101/xxx.full.pdf)
    if (
      (u.hostname.includes("biorxiv.org") || u.hostname.includes("medrxiv.org")) &&
      path.includes("/pdf/")
    ) return true;
    return false;
  } catch {
    return false;
  }
}

export interface RawPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  venue: string;
  year: number;
  doi: string;
  citationCount: number;
  source: "openalex" | "crossref" | "semantic_scholar" | "web" | "pdf_upload";
  embedding?: number[]; // nomic-embed-text embedding, attached during search dedup
  openAccessPdfUrl?: string; // open-access PDF URL for figure extraction
}

// ─── OpenAlex (primary — free, 100k req/day with polite pool) ───────────────

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return "";
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map((w) => w[1]).join(" ");
}

async function searchOpenAlex(query: string, limit = 15): Promise<RawPaper[]> {
  console.log(`[paper-search] 📡 OpenAlex: starting search...`);
  try {
    const params = new URLSearchParams({
      search: query.slice(0, 200),
      per_page: String(limit),
      select:
        "id,title,authorships,publication_year,cited_by_count,primary_location,doi,abstract_inverted_index,open_access",
      mailto: "schrollar-app@example.com", // polite pool
    });

    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`OpenAlex returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as AnyRecord;
    const results = (data.results as AnyRecord[]) || [];

    const mapped = results
      .map((r): RawPaper | null => {
        const abstract = reconstructAbstract(r.abstract_inverted_index);
        if (!abstract || abstract.length < 50) return null;

        const authors = ((r.authorships as AnyRecord[]) || [])
          .map((a) => a.author?.display_name as string)
          .filter(Boolean);

        const venue =
          r.primary_location?.source?.display_name || "Academic Publication";
        const doi = (r.doi as string)?.replace("https://doi.org/", "") || "";

        const oaUrl = (r.open_access as AnyRecord)?.oa_url as string | undefined;

        return {
          id: (r.id as string) || `oa-${Math.random().toString(36).slice(2)}`,
          title: r.title as string,
          abstract,
          authors,
          venue,
          year: (r.publication_year as number) || 0,
          doi,
          citationCount: (r.cited_by_count as number) || 0,
          source: "openalex",
          openAccessPdfUrl: isPdfUrl(oaUrl) ? oaUrl : undefined,
        };
      })
      .filter((p): p is RawPaper => p !== null);
    console.log(`[paper-search] ✅ OpenAlex: ${mapped.length} valid papers`);
    return mapped;
  } catch (err) {
    console.warn("[paper-search] ❌ OpenAlex search failed:", err);
    return [];
  }
}

// ─── CrossRef (secondary — free, no key needed) ────────────────────────────

async function searchCrossRef(query: string, limit = 10): Promise<RawPaper[]> {
  console.log(`[paper-search] 📡 CrossRef: starting search...`);
  try {
    const params = new URLSearchParams({
      query: query.slice(0, 200),
      rows: String(limit),
      select:
        "DOI,title,author,abstract,container-title,published-print,is-referenced-by-count",
      mailto: "schrollar-app@example.com",
    });

    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`CrossRef returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as AnyRecord;
    const items = (data.message?.items as AnyRecord[]) || [];

    const mapped = items
      .map((item): RawPaper | null => {
        // Abstract comes as HTML — strip tags
        const rawAbstract = (item.abstract as string) || "";
        const abstract = rawAbstract.replace(/<[^>]*>/g, "").trim();
        if (abstract.length < 50) return null;

        const title = Array.isArray(item.title)
          ? (item.title[0] as string)
          : (item.title as string) || "";
        if (!title) return null;

        const authors = ((item.author as AnyRecord[]) || []).map((a) =>
          `${a.given || ""} ${a.family || ""}`.trim(),
        );

        const venue = Array.isArray(item["container-title"])
          ? (item["container-title"][0] as string)
          : (item["container-title"] as string) || "";

        const dateParts =
          item["published-print"]?.["date-parts"]?.[0] ||
          item["published-online"]?.["date-parts"]?.[0] ||
          item["issued"]?.["date-parts"]?.[0];
        const year = dateParts?.[0] || 0;

        return {
          id: `cr-${Math.random().toString(36).slice(2)}`,
          title,
          abstract,
          authors,
          venue: venue || "Academic Publication",
          year,
          doi: (item.DOI as string) || "",
          citationCount: (item["is-referenced-by-count"] as number) || 0,
          source: "crossref",
        };
      })
      .filter((p): p is RawPaper => p !== null);
    console.log(`[paper-search] ✅ CrossRef: ${mapped.length} valid papers`);
    return mapped;
  } catch (err) {
    console.warn("[paper-search] ❌ CrossRef search failed:", err);
    return [];
  }
}

// ─── Semantic Scholar (tertiary — rate-limited without key) ────────────────

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";
const S2_API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

async function searchSemanticScholar(
  query: string,
  limit = 15,
): Promise<RawPaper[]> {
  console.log(`[paper-search] 📡 S2: starting search...`);
  try {
    const params = new URLSearchParams({
      query: query.slice(0, 200),
      limit: String(limit),
      fields:
        "title,abstract,url,year,citationCount,authors,venue,externalIds,journal,openAccessPdf",
    });

    const headers: Record<string, string> = {};
    if (S2_API_KEY) {
      headers["x-api-key"] = S2_API_KEY;
    }

    const res = await fetch(`${S2_API}?${params}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("S2 rate limited (429), skipping");
      } else {
        console.warn(`S2 returned ${res.status}`);
      }
      return [];
    }

    const data = (await res.json()) as AnyRecord;
    const results = (data.data as AnyRecord[]) || [];

    const mapped = results
      .map((r): RawPaper | null => {
        const abstract = (r.abstract as string) || "";
        if (abstract.length < 50) return null;

        const authors = ((r.authors as AnyRecord[]) || []).map(
          (a) => a.name as string,
        );
        const venue =
          (r.venue as string) ||
          (r.journal as AnyRecord)?.name ||
          "Academic Publication";

        const s2PdfUrl = (r.openAccessPdf as AnyRecord)?.url as
          | string
          | undefined;

        return {
          id:
            (r.paperId as string) ||
            `s2-${Math.random().toString(36).slice(2)}`,
          title: r.title as string,
          abstract,
          authors,
          venue: venue as string,
          year: (r.year as number) || 0,
          doi: (r.externalIds as AnyRecord)?.DOI || "",
          citationCount: (r.citationCount as number) || 0,
          source: "semantic_scholar",
          openAccessPdfUrl: s2PdfUrl,
        };
      })
      .filter((p): p is RawPaper => p !== null);
    console.log(`[paper-search] ✅ S2: ${mapped.length} valid papers`);
    return mapped;
  } catch (err) {
    console.warn("[paper-search] ❌ S2 search failed:", err);
    return [];
  }
}

// ─── Unified search across all sources ────────────────────────────────────

import { safeEmbedBatch, deduplicateByEmbedding } from "@/lib/embeddings";

// Source priority for dedup: prefer OpenAlex > S2 > CrossRef
const SOURCE_PRIORITY: Record<string, number> = {
  openalex: 0,
  semantic_scholar: 1,
  crossref: 2,
  web: 3,
  pdf_upload: -1, // always keep PDFs
};

export async function searchPapers(
  query: string,
  targetCount = 15,
  options?: { skipEmbeddings?: boolean },
): Promise<RawPaper[]> {
  console.log(
    `[paper-search] Searching for: "${query}" (target: ${targetCount})`,
  );

  // Run OpenAlex + CrossRef in parallel (both reliable and free)
  // S2 runs in parallel too but may fail due to rate limits
  const [openAlexResults, crossRefResults, s2Results] = await Promise.all([
    searchOpenAlex(query, targetCount),
    searchCrossRef(query, Math.min(targetCount, 10)),
    searchSemanticScholar(query, targetCount),
  ]);

  console.log(
    `[paper-search] Results — OpenAlex: ${openAlexResults.length}, CrossRef: ${crossRefResults.length}, S2: ${s2Results.length}`,
  );

  // First pass: exact title dedup (fast, catches obvious duplicates)
  const seen = new Set<string>();
  const allPapers: RawPaper[] = [];

  // Priority: OpenAlex first (best abstracts), then S2, then CrossRef
  for (const paper of [...openAlexResults, ...s2Results, ...crossRefResults]) {
    const key = paper.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    allPapers.push(paper);
  }

  console.log(`[paper-search] After title dedup: ${allPapers.length} papers`);

  // Skip embedding-based dedup if requested (saves CPU + subrequests for CF Workers)
  if (options?.skipEmbeddings) {
    const result = allPapers.slice(0, targetCount);
    console.log(
      `[paper-search] Final result (no embedding dedup): ${result.length} papers`,
    );
    return result;
  }

  // Second pass: embedding-based semantic dedup (catches near-duplicates)
  const embeddingTexts = allPapers.map(
    (p) => `${p.title}. ${p.abstract.slice(0, 500)}`,
  );
  const embeddings = await safeEmbedBatch(embeddingTexts);

  let merged: RawPaper[];

  if (embeddings) {
    // Attach embeddings to papers
    for (let i = 0; i < allPapers.length; i++) {
      allPapers[i].embedding = embeddings[i];
    }

    // Semantic dedup: remove papers with >0.92 similarity, keeping higher-priority source
    const keepIndices = deduplicateByEmbedding(embeddings, 0.92, (a, b) => {
      // Prefer by: citation count first, then source priority
      const citDiff =
        (allPapers[a].citationCount || 0) - (allPapers[b].citationCount || 0);
      if (citDiff !== 0) return citDiff > 0 ? a : b;
      const priA = SOURCE_PRIORITY[allPapers[a].source] ?? 99;
      const priB = SOURCE_PRIORITY[allPapers[b].source] ?? 99;
      return priA <= priB ? a : b;
    });

    merged = keepIndices.map((i) => allPapers[i]);
    console.log(
      `[paper-search] After semantic dedup: ${merged.length} papers (removed ${allPapers.length - merged.length} near-duplicates)`,
    );
  } else {
    // Embedding failed — fall back to title-only dedup
    merged = allPapers;
  }

  const result = merged.slice(0, targetCount);
  console.log(`[paper-search] Final result: ${result.length} papers`);
  return result;
}
