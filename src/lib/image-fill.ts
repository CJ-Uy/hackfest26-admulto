/**
 * Ensures every Nth paper in a scroll has an image by fetching a relevant
 * Wikipedia thumbnail for papers that are missing one.
 *
 * Uses Wikipedia's generator+search API to find related articles and batch-fetch
 * thumbnails in a single request — much more reliable than exact title lookup.
 */

import { uploadImage } from "@/lib/r2";
import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";

/** Ensure an image exists on every Nth paper (1-indexed: 3rd, 6th, 9th…). */
const IMAGE_EVERY_N = 3;
const WIKI_THUMB_SIZE = 800;
const FETCH_TIMEOUT_MS = 10_000;

// User-Agent required by Wikimedia API policy
const USER_AGENT = "Schrollar/1.0 (research-paper-discovery-app; schrollar-app@example.com)";

// Common stop words to skip when building a search keyword from a paper title
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "but", "is", "are", "was", "were", "be", "been", "by", "from",
  "its", "via", "into", "using", "based", "through", "between", "toward",
  "novel", "new", "approach", "approaches", "method", "methods", "study",
  "analysis", "review", "survey", "framework", "system", "model", "models",
]);

/** Detect MIME type from buffer magic bytes. Falls back to image/jpeg. */
export function detectImageMime(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Extract meaningful content words from a paper title for a Wikipedia search query.
 * Returns progressively shorter fallback queries.
 */
function titleToKeywords(title: string): string[] {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const queries: string[] = [];
  // Full query (up to 5 significant words)
  if (words.length > 0) queries.push(words.slice(0, 5).join(" "));
  // Shorter fallback (first 3)
  if (words.length > 3) queries.push(words.slice(0, 3).join(" "));
  // Minimal fallback (first 2)
  if (words.length > 2) queries.push(words.slice(0, 2).join(" "));

  return [...new Set(queries)].filter(Boolean);
}

/**
 * Search Wikipedia for articles related to a keyword using the generator API,
 * which returns search results AND their thumbnails in a single request.
 * Returns the first usable image buffer, or null.
 */
async function searchWikipediaImage(keyword: string): Promise<ArrayBuffer | null> {
  if (!keyword.trim()) return null;

  try {
    // Single request: search for articles AND get their page images
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

    const apiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!apiRes.ok) return null;

    const data = (await apiRes.json()) as {
      query?: {
        pages?: Record<string, { thumbnail?: { source?: string } }>;
      };
    };

    const pages = data.query?.pages;
    if (!pages) return null;

    // Pages are returned in arbitrary order; iterate and take first with a thumbnail
    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (!src) continue;

      // Skip SVG-based thumbnails (they're usually logos/icons, not informative photos)
      if (src.includes(".svg")) continue;

      const imgRes = await fetch(src, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (imgRes.ok) return imgRes.arrayBuffer();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Try multiple keyword strategies derived from the paper title,
 * returning the first successfully fetched image.
 */
async function fetchImageForTitle(title: string): Promise<ArrayBuffer | null> {
  const queries = titleToKeywords(title);

  for (const query of queries) {
    const buffer = await searchWikipediaImage(query);
    if (buffer && buffer.byteLength > 1000) return buffer; // sanity-check non-empty
  }

  return null;
}

/**
 * After synthesis, ensure every IMAGE_EVERY_N-th paper has an image.
 * Papers at 1-indexed positions 3, 6, 9… that are missing an image get a
 * Wikipedia thumbnail fetched and uploaded to R2.
 *
 * @param scrollId          The scroll being generated.
 * @param orderedPapers     Papers in display order (same order as inserted).
 * @param papersWithImages  Paper IDs that already received an imageKey during synthesis.
 */
export async function fillScrollImages(
  scrollId: string,
  orderedPapers: Array<{ id: string; title: string }>,
  papersWithImages: Set<string>,
): Promise<void> {
  // Target every Nth paper (0-indexed: 2, 5, 8, …) that has no image yet
  const targets = orderedPapers.filter(
    (p, i) => (i + 1) % IMAGE_EVERY_N === 0 && !papersWithImages.has(p.id),
  );

  if (targets.length === 0) {
    console.log(`[image-fill] No missing images to fill for scroll ${scrollId}`);
    return;
  }

  console.log(
    `[image-fill] Filling ${targets.length} images for scroll ${scrollId} (positions: ${
      orderedPapers
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => (i + 1) % IMAGE_EVERY_N === 0 && !papersWithImages.has(p.id))
        .map(({ i }) => i + 1)
        .join(", ")
    })`,
  );

  for (const paper of targets) {
    try {
      console.log(`[image-fill] Fetching Wikipedia image for: "${paper.title.slice(0, 70)}"`);
      const imageBuffer = await fetchImageForTitle(paper.title);

      if (!imageBuffer) {
        console.log(`[image-fill] No Wikipedia image found for "${paper.title.slice(0, 60)}"`);
        continue;
      }

      const mime = detectImageMime(imageBuffer);
      const ext = mime === "image/png" ? "png" : "jpg";
      const key = `images/${scrollId}/${paper.id}.${ext}`;

      await uploadImage(imageBuffer, key, mime);
      await db.update(papers).set({ imageKey: key }).where(eq(papers.id, paper.id));

      console.log(`[image-fill] ✅ Image saved (${mime}) for "${paper.title.slice(0, 60)}"`);
    } catch (err) {
      console.warn(`[image-fill] Failed for paper ${paper.id}:`, err);
    }
  }
}
