/**
 * Ensures every Nth paper in a scroll has an image.
 *
 * Strategy:
 * - Papers that got images from open-access PDF extraction keep their R2 imageKey.
 * - Papers at every 3rd position that are missing an image get a Wikipedia
 *   thumbnail fetched, downloaded, and uploaded to R2.
 * - imageKey always stores an R2 key (e.g. "images/{scrollId}/{paperId}.jpg").
 * - The /api/paper-images/[...key] route serves all images from R2.
 *
 * Wikipedia lookup order (most to least reliable):
 *  1. Topic keywords from LLM expansion (e.g. "mineralogy", "gemstones")
 *  2. Content words from the paper title (2-word, 3-word, single-word)
 */

import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { uploadImage } from "@/lib/r2";
import { eq } from "drizzle-orm";

const IMAGE_EVERY_N = 3;
const WIKI_THUMB_SIZE = 800;
const FETCH_TIMEOUT_MS = 5_000;

const USER_AGENT =
  "Schrollar/1.0 (research-paper-discovery-app; schrollar-app@example.com)";

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "but", "is", "are", "was", "were", "be", "been", "by", "from",
  "its", "via", "into", "using", "based", "through", "between", "toward",
  "novel", "new", "approach", "approaches", "method", "methods", "study",
  "analysis", "review", "survey", "towards", "across", "without", "beyond",
]);

/** Detect MIME type from buffer magic bytes (also used by paper-images route). */
export function detectImageMime(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/** Extract meaningful content words from a paper title, returning query candidates. */
function titleToQueries(title: string): string[] {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const queries: string[] = [];
  if (words.length >= 2) queries.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) queries.push(words.slice(0, 3).join(" "));
  if (words.length >= 1) queries.push(words[0]);
  return [...new Set(queries)].filter(Boolean);
}

/**
 * Wikipedia REST Summary API — direct article lookup by title.
 * Very reliable when the keyword matches a Wikipedia article name exactly.
 */
async function getWikiSummaryThumb(keyword: string): Promise<string | null> {
  if (!keyword.trim()) return null;
  try {
    const encoded = encodeURIComponent(keyword.trim());
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    const src = data.thumbnail?.source ?? data.originalimage?.source;
    if (!src || src.includes(".svg")) return null;
    return src;
  } catch {
    return null;
  }
}

/**
 * Wikipedia generator search API — fuzzy keyword search, returns thumbnails.
 * Good for phrases that don't exactly match an article title.
 */
async function getWikiSearchThumb(keyword: string): Promise<string | null> {
  if (!keyword.trim()) return null;
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: keyword,
      gsrnamespace: "0",
      gsrlimit: "8",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: String(WIKI_THUMB_SIZE),
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<string, { thumbnail?: { source?: string } }>;
      };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (src && !src.includes(".svg")) return src;
    }
    return null;
  } catch {
    return null;
  }
}

/** Download image bytes from a URL. Returns null on any failure. */
async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Try to get a Wikipedia thumbnail URL from an ordered list of query candidates.
 * Tries REST Summary first (fastest), then generator search.
 */
async function findThumbUrl(candidates: string[]): Promise<string | null> {
  // First pass: REST Summary (direct article lookup, no thumbnail missing)
  for (const q of candidates) {
    const url = await getWikiSummaryThumb(q);
    if (url) return url;
  }
  // Second pass: generator search (fuzzy, broader)
  for (const q of candidates) {
    const url = await getWikiSearchThumb(q);
    if (url) return url;
  }
  return null;
}

/**
 * After synthesis, ensure every IMAGE_EVERY_N-th paper has an image.
 *
 * @param scrollId         The scroll being generated.
 * @param orderedPapers    Papers in display order (id + title).
 * @param papersWithImages Paper IDs that already have an R2 imageKey.
 * @param topicKeywords    Keywords from query expansion (e.g. ["mineralogy","gemstones"]).
 *                         These are tried first since they map directly to Wikipedia articles.
 */
export async function fillScrollImages(
  scrollId: string,
  orderedPapers: Array<{ id: string; title: string }>,
  papersWithImages: Set<string>,
  topicKeywords?: string[],
): Promise<void> {
  const targets = orderedPapers.filter(
    (p, i) => (i + 1) % IMAGE_EVERY_N === 0 && !papersWithImages.has(p.id),
  );

  if (targets.length === 0) {
    console.log(`[image-fill] No missing images for scroll ${scrollId}`);
    return;
  }

  // Deduplicated topic keyword candidates (clean single words/phrases from expansion)
  const topicCandidates = [
    ...(topicKeywords ?? []).filter((k) => k && k.trim().length > 1),
  ].slice(0, 4);

  console.log(
    `[image-fill] Filling ${targets.length} images for scroll ${scrollId}` +
      (topicCandidates.length ? ` | topic fallbacks: ${topicCandidates.join(", ")}` : ""),
  );

  await Promise.all(
    targets.map(async (paper) => {
      try {
        // Build query list: topic keywords first (most Wikipedia-friendly),
        // then paper-title-derived words as fallback
        const titleCandidates = titleToQueries(paper.title);
        const allCandidates = [
          ...topicCandidates,
          ...titleCandidates,
        ].filter(Boolean);

        const thumbUrl = await findThumbUrl(allCandidates);

        if (!thumbUrl) {
          console.log(
            `[image-fill] No Wikipedia image for "${paper.title.slice(0, 60)}"`,
          );
          return;
        }

        const buffer = await downloadImage(thumbUrl);
        if (!buffer || buffer.byteLength === 0) {
          console.log(
            `[image-fill] Download failed for "${paper.title.slice(0, 60)}"`,
          );
          return;
        }

        const mime = detectImageMime(buffer);
        const ext =
          mime === "image/png"
            ? "png"
            : mime === "image/gif"
              ? "gif"
              : mime === "image/webp"
                ? "webp"
                : "jpg";
        const r2Key = `images/${scrollId}/${paper.id}.${ext}`;

        await uploadImage(buffer, r2Key, mime);

        await db
          .update(papers)
          .set({ imageKey: r2Key })
          .where(eq(papers.id, paper.id));

        console.log(
          `[image-fill] ✅ ${r2Key} saved for "${paper.title.slice(0, 60)}"`,
        );
      } catch (err) {
        console.warn(`[image-fill] Failed for paper ${paper.id}:`, err);
      }
    }),
  );
}
