/**
 * Ensures every Nth paper in a scroll has an image.
 *
 * Strategy:
 * - Papers that got images from open-access PDF extraction keep their R2 imageKey.
 * - Papers at every 3rd position that are missing an image get a Wikipedia
 *   thumbnail fetched, downloaded, and uploaded to R2.
 * - imageKey always stores an R2 key (e.g. "images/{scrollId}/{paperId}.jpg").
 * - The /api/paper-images/[...key] route serves all images from R2.
 */

import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { uploadImage } from "@/lib/r2";
import { eq } from "drizzle-orm";

/** Ensure an image exists on every Nth paper (1-indexed: 3rd, 6th, 9th…). */
const IMAGE_EVERY_N = 3;
const WIKI_THUMB_SIZE = 800;
const FETCH_TIMEOUT_MS = 8_000;

// User-Agent required by Wikimedia API policy
const USER_AGENT =
  "Schrollar/1.0 (research-paper-discovery-app; schrollar-app@example.com)";

// Common words that don't help narrow a Wikipedia search for academic topics
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

/** Extract meaningful content words from a paper title. */
function titleToKeywords(title: string): string[] {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const queries: string[] = [];
  // Prefer 2-word queries — best Wikipedia match rate
  if (words.length >= 2) queries.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) queries.push(words.slice(0, 3).join(" "));
  if (words.length >= 1) queries.push(words[0]); // single keyword fallback
  return [...new Set(queries)].filter(Boolean);
}

/**
 * Try the Wikipedia REST Summary API for a direct article lookup.
 * Returns a thumbnail URL or null.
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
 * Search Wikipedia using the generator API (fuzzy search + thumbnails in one call).
 * Returns a thumbnail URL or null.
 */
async function getWikiSearchThumb(keyword: string): Promise<string | null> {
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
      if (src && !src.includes(".svg")) return src;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Download an image from a URL and return its ArrayBuffer.
 * Returns null on any failure.
 */
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
 * After synthesis, ensure every IMAGE_EVERY_N-th paper has an image.
 *
 * Fetches a Wikipedia thumbnail, downloads the bytes, uploads to R2, and
 * stores the R2 key as `imageKey` on the paper row.
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

      // 1. Try REST Summary API first (direct lookup, most reliable)
      for (const query of queries.slice(0, 2)) {
        thumbUrl = await getWikiSummaryThumb(query);
        if (thumbUrl) break;
      }

      // 2. Fall back to generator search API (fuzzy)
      if (!thumbUrl) {
        for (const query of queries) {
          thumbUrl = await getWikiSearchThumb(query);
          if (thumbUrl) break;
        }
      }

      if (!thumbUrl) {
        console.log(
          `[image-fill] No Wikipedia image for "${paper.title.slice(0, 60)}"`,
        );
        continue;
      }

      // 3. Download the image bytes
      const buffer = await downloadImage(thumbUrl);
      if (!buffer || buffer.byteLength === 0) {
        console.log(`[image-fill] Download failed for "${paper.title.slice(0, 60)}"`);
        continue;
      }

      // 4. Upload to R2
      const mime = detectImageMime(buffer);
      const ext = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "jpg";
      const r2Key = `images/${scrollId}/${paper.id}.${ext}`;
      await uploadImage(buffer, r2Key, mime);

      // 5. Store R2 key in DB
      await db
        .update(papers)
        .set({ imageKey: r2Key })
        .where(eq(papers.id, paper.id));

      console.log(
        `[image-fill] ✅ R2 image saved for "${paper.title.slice(0, 60)}" → ${r2Key}`,
      );
    } catch (err) {
      console.warn(`[image-fill] Failed for paper ${paper.id}:`, err);
    }
  }
}
