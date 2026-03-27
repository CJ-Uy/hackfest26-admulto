/**
 * Extract the first meaningful figure/image from a PDF.
 *
 * Uses unpdf's extractImages (pdfjs operator-based, no canvas needed)
 * and upng-js for pure-JS PNG encoding — both compatible with Cloudflare Workers.
 */

import UPNG from "upng-js";

const MAX_PAGES_TO_SCAN = 5;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 8000;

/**
 * Encode raw pixel data (from unpdf extractImages) as a PNG ArrayBuffer.
 */
function encodePng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  channels: 1 | 3 | 4,
): ArrayBuffer {
  // UPNG.encode expects RGBA — convert if needed
  let rgba: Uint8Array;
  if (channels === 4) {
    rgba = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
  } else if (channels === 3) {
    rgba = new Uint8Array(width * height * 4);
    for (let i = 0, j = 0; i < width * height; i++, j += 3) {
      rgba[i * 4] = data[j];
      rgba[i * 4 + 1] = data[j + 1];
      rgba[i * 4 + 2] = data[j + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else {
    // Grayscale
    rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = data[i];
      rgba[i * 4 + 1] = data[i];
      rgba[i * 4 + 2] = data[i];
      rgba[i * 4 + 3] = 255;
    }
  }

  return UPNG.encode([rgba.buffer as ArrayBuffer], width, height, 0);
}

/**
 * Extract the first meaningful image from a PDF buffer.
 * Scans up to MAX_PAGES_TO_SCAN pages and returns the first image
 * that exceeds the minimum size threshold.
 *
 * Returns a PNG-encoded ArrayBuffer, or null if no suitable image found.
 */
export async function extractFirstFigure(
  pdfBuffer: ArrayBuffer,
): Promise<ArrayBuffer | null> {
  const { extractImages, getDocumentProxy } = await import("unpdf");

  const doc = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const pagesToScan = Math.min(doc.numPages, MAX_PAGES_TO_SCAN);

  for (let page = 1; page <= pagesToScan; page++) {
    try {
      const images = await extractImages(doc, page);

      for (const img of images) {
        if (img.width >= MIN_WIDTH && img.height >= MIN_HEIGHT) {
          return encodePng(img.data, img.width, img.height, img.channels);
        }
      }
    } catch {
      // Skip pages that fail to extract — continue to next
      continue;
    }
  }

  return null;
}

/**
 * Fetch an open-access PDF and extract the first figure.
 * Returns a PNG-encoded ArrayBuffer, or null on failure.
 */
export async function fetchPdfAndExtractFigure(
  pdfUrl: string,
): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(pdfUrl, {
      signal: controller.signal,
      headers: { Accept: "application/pdf" },
    });

    if (!res.ok) return null;

    // Check content-length to avoid downloading huge files
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_PDF_SIZE) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_PDF_SIZE) return null;

    return await extractFirstFigure(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
