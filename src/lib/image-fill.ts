/**
 * Ensures every Nth paper in a scroll has an image.
 *
 * Strategy:
 * - Papers that got images from open-access PDF extraction keep their R2 imageKey.
 * - Papers at every 3rd position that are missing an image get a Wikipedia
 *   thumbnail URL fetched and stored directly as imageKey (no R2 upload needed).
 * - The scroll/paper APIs detect "http" prefixed imageKeys and serve them directly
 *   instead of routing through /api/paper-images/.
 */

import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";

/** Ensure an image exists on every Nth paper (1-indexed: 3rd, 6th, 9th…). */
const IMAGE_EVERY_N = 3;
const WIKI_THUMB_SIZE = 800;
const FETCH_TIMEOUT_MS = 5_000; // kept short — just one API call, no download

// User-Agent required by Wikimedia API policy
const USER_AGENT =
  "Schrollar/1.0 (research-paper-discovery-app; schrollar-app@example.com)";

// Words that don't help narrow a Wikipedia search for academic topics
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "but", "is", "are", "was", "were", "be", "been", "by", "from",
  "its", "via", "into", "using", "based", "through", "between", "toward",
  "novel", "new", "approach", "approaches", "method", "methods", "study",
  "analysis", "review", "survey", "framework", "system", "model", "models",
  "deep", "large", "towards", "across", "without", "beyond",
]);

/** Detect MIME type from buffer magic bytes (used by paper-images route). */
export function detectImageMime(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Extract meaningful content words from a paper title.
 * Returns progressively shorter fallback queries to maximise Wikipedia match rate.
 */
function titleToKeywords(title: string): string[] {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const queries: string[] = [];
  if (words.length >= 1) queries.push(words.slice(0, 4).join(" "));
  if (words.length >= 4) queries.push(words.slice(0, 3).join(" "));
  if (words.length >= 3) queries.push(words.slice(0, 2).join(" "));
  return [...new Set(queries)].filter(Boolean);
}

/**
 * Search Wikipedia for articles related to `keyword` using the generator API
 * (searches + fetches thumbnails in ONE request).
 * Returns a thumbnail URL string, or null if nothing found.
 */
async function getWikipediaThumbnailUrl(keyword: string): Promise<string | null> {
  if (!keyword.trim()) return null;

  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: keyword,
      gsrnamespace: "0",
      gsrlimit: "5",
      prop: "pageimages",
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
      if (!src) continue;
      // Skip SVG thumbnails — they're usually logos, not informative photos
      if (src.includes(".svg")) continue;
      return src; // ✅ Just the URL — no download needed
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * After synthesis, ensure every IMAGE_EVERY_N-th paper has an image.
 *
 * For missing images, fetches a Wikipedia thumbnail URL (single fast API call)
 * and stores it directly as `imageKey`. The scroll/paper GET APIs detect URLs
 * (starting with "http") and serve them directly without R2 routing.
 *
 * @param scrollId          The scroll being generated.
 * @param orderedPapers     Papers in display order.
 * @param papersWithImages  Paper IDs that already got an R2 imageKey during synthesis.
 */
export async function fillScrollImages(
  scrollId: string,
  orderedPapers: Array<{ id: string; title: string }>,
  papersWithImages: Set<string>,
): Promise<void> {
  const targets = orderedPapers.filter(
    (p, i) => (i + 1) % IMAGE_EVERY_N === 0 && !papersWithImages.has(p.id),
  );

  if (targets.length === 0) {
    console.log(`[image-fill] No missing images for scroll ${scrollId}`);
    return;
  }

  console.log(
    `[image-fill] Filling ${targets.length} Wikipedia images for scroll ${scrollId}`,
  );

  for (const paper of targets) {
    try {
      const queries = titleToKeywords(paper.title);
      let thumbUrl: string | null = null;

      for (const query of queries) {
        thumbUrl = await getWikipediaThumbnailUrl(query);
        if (thumbUrl) break;
      }

      if (!thumbUrl) {
        console.log(
          `[image-fill] No Wikipedia image for "${paper.title.slice(0, 60)}"`,
        );
        continue;
      }

      // Store the URL directly — no R2 upload, no heavy download
      await db
        .update(papers)
        .set({ imageKey: thumbUrl })
        .where(eq(papers.id, paper.id));

      console.log(
        `[image-fill] ✅ Wikipedia URL saved for "${paper.title.slice(0, 60)}"`,
      );
    } catch (err) {
      console.warn(`[image-fill] Failed for paper ${paper.id}:`, err);
    }
  }
}
