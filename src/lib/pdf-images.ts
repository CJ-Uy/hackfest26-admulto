/**
 * Extract the first meaningful figure from a PDF buffer.
 * Uses unpdf's extractImages (pdfjs operator-based, no canvas required — Workers-compatible).
 * Encodes raw pixel data to PNG using upng-js (pure JS, no native deps).
 */

import { extractImages, getDocumentProxy } from "unpdf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const UPNG = require("upng-js") as {
  encode: (bufs: ArrayBuffer[], w: number, h: number, cnum: number) => ArrayBuffer;
};

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 8_000;
const MAX_PAGES = 15;

/**
 * Convert raw pixel data (1/3/4 channels) to RGBA ArrayBuffer.
 */
function toRGBA(data: Uint8ClampedArray, channels: 1 | 3 | 4): ArrayBuffer {
  if (channels === 4) {
    return new Uint8Array(data).buffer;
  }

  const pixels = data.length / channels;
  const rgba = new Uint8ClampedArray(pixels * 4);

  for (let i = 0; i < pixels; i++) {
    const src = i * channels;
    const dst = i * 4;
    if (channels === 1) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = data[src];
    } else {
      // channels === 3
      rgba[dst] = data[src];
      rgba[dst + 1] = data[src + 1];
      rgba[dst + 2] = data[src + 2];
    }
    rgba[dst + 3] = 255;
  }

  return rgba.buffer;
}

/**
 * Extract the first qualifying figure from a PDF buffer.
 * Returns a PNG ArrayBuffer, or null if no suitable image found.
 */
export async function extractFirstFigure(
  pdfBuffer: ArrayBuffer,
): Promise<ArrayBuffer | null> {
  // Load the document proxy ONCE so pdfjs doesn't detach the buffer between page calls
  let proxy: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    proxy = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const totalPages = Math.min(proxy.numPages, MAX_PAGES);

    for (let page = 1; page <= totalPages; page++) {
      let images;
      try {
        images = await extractImages(proxy, page);
      } catch {
        continue;
      }

      for (const img of images) {
        if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) continue;

        try {
          const rgbaBuffer = toRGBA(img.data, img.channels);
          const png = UPNG.encode([rgbaBuffer], img.width, img.height, 0);
          return png;
        } catch {
          continue;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn("[pdf-images] extractFirstFigure failed:", err);
    return null;
  } finally {
    proxy?.destroy();
  }
}

/**
 * Fetch a PDF from a URL and extract the first figure.
 * Returns a PNG ArrayBuffer, or null on any error.
 */
export async function fetchPdfAndExtractFigure(
  pdfUrl: string,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(pdfUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/pdf" },
    });

    if (!res.ok) return null;

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PDF_BYTES) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_PDF_BYTES) return null;

    return extractFirstFigure(buffer);
  } catch (err) {
    console.warn("[pdf-images] fetchPdfAndExtractFigure failed:", err);
    return null;
  }
}
