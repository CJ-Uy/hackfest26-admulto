/**
 * Ensures every Nth paper in a scroll has an image by fetching a relevant
 * Wikipedia thumbnail for papers that are missing one.
 *
 * Called once after all papers are synthesized during feed generation.
 */

import { uploadImage } from "@/lib/r2";
import { db } from "@/lib/db";
import { papers } from "@/lib/schema";
import { eq } from "drizzle-orm";

/** Image every N papers (1-indexed: 3rd, 6th, 9th…). */
const IMAGE_EVERY_N = 3;
const WIKI_THUMB_SIZE = 800;
const FETCH_TIMEOUT_MS = 8_000;

// Common stop words to skip when building a Wikipedia keyword from a title
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "but", "is", "are", "was", "were", "be", "been", "by", "from",
  "its", "via", "into", "using", "based", "through", "between", "toward",
]);

/** Detect MIME type from buffer magic bytes. Falls back to image/jpeg. */
export function detectImageMime(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp"; // RIFF/WEBP
  return "image/jpeg";
}

/**
 * Extract 3-4 meaningful content words from a paper title for Wikipedia search.
 */
function titleToKeyword(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 4)
    .join(" ");
}

/**
 * Fetch a Wikipedia page thumbnail for the given keyword.
 * Returns image bytes or null on failure.
 */
async function fetchWikipediaImage(keyword: string): Promise<ArrayBuffer | null> {
  if (!keyword.trim()) return null;

  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "pageimages",
      format: "json",
      pithumbsize: String(WIKI_THUMB_SIZE),
      titles: keyword,
      redirects: "1",
      origin: "*",
    });

    const apiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!apiRes.ok) return null;

    const data = (await apiRes.json()) as {
      query?: {
        pages?: Record<string, { thumbnail?: { source?: string } }>;
      };
    };

    const pages = data.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (!src) continue;
      // Skip SVG thumbnails — they render poorly as card images
      if (src.endsWith(".svg") || src.includes(".svg/")) continue;

      const imgRes = await fetch(src, {
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
 * After synthesis, ensure every IMAGE_EVERY_N-th paper has an image.
 *
 * @param scrollId        The scroll being generated.
 * @param orderedPapers   Papers in their display order (same order inserted).
 * @param papersWithImages Set of paper IDs that already received an imageKey
 *                         during synthesis (from open-access PDF extraction).
 */
export async function fillScrollImages(
  scrollId: string,
  orderedPapers: Array<{ id: string; title: string }>,
  papersWithImages: Set<string>,
): Promise<void> {
  // Papers at 0-indexed positions 2, 5, 8, … that don't yet have an image
  const targets = orderedPapers.filter(
    (p, i) => (i + 1) % IMAGE_EVERY_N === 0 && !papersWithImages.has(p.id),
  );

  if (targets.length === 0) return;

  console.log(`[image-fill] Filling images for ${targets.length} papers in scroll ${scrollId}`);

  for (const paper of targets) {
    try {
      const keyword = titleToKeyword(paper.title);
      if (!keyword) continue;

      const imageBuffer = await fetchWikipediaImage(keyword);
      if (!imageBuffer) {
        console.log(`[image-fill] No Wikipedia image found for "${paper.title.slice(0, 60)}"`);
        continue;
      }

      const mime = detectImageMime(imageBuffer);
      const ext = mime === "image/png" ? "png" : "jpg";
      const key = `images/${scrollId}/${paper.id}.${ext}`;

      await uploadImage(imageBuffer, key, mime);
      await db.update(papers).set({ imageKey: key }).where(eq(papers.id, paper.id));

      console.log(`[image-fill] ✅ Wikipedia image saved for "${paper.title.slice(0, 60)}"`);
    } catch (err) {
      console.warn(`[image-fill] Failed for paper ${paper.id}:`, err);
    }
  }
}
