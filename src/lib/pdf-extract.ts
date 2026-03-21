import type { RawPaper } from "./paper-search";

export interface ExtractedPdf {
  filename: string;
  text: string;
  title: string;
  authors: string[];
  abstract: string;
}

/**
 * Extract text content from a PDF buffer.
 * Uses unpdf which is compatible with Cloudflare Workers / edge runtimes.
 * Caps extraction at 30 pages to stay within Workers memory limits.
 */
export async function extractPdfContent(
  pdfBuffer: ArrayBuffer,
  filename: string,
): Promise<ExtractedPdf> {
  const { extractText, getMeta } = await import("unpdf");

  const meta = await getMeta(pdfBuffer);
  const { text: fullText } = await extractText(pdfBuffer, { mergePages: true });

  const cleanText = fullText.replace(/\s+/g, " ").trim();

  const title = extractTitle(meta?.info, cleanText, filename);
  const authors = extractAuthors(meta?.info, cleanText);
  const abstract = extractAbstract(cleanText);

  return { filename, text: cleanText, title, authors, abstract };
}

function extractTitle(
  info: Record<string, unknown> | undefined,
  text: string,
  filename: string,
): string {
  // Try PDF metadata first
  if (info?.Title && typeof info.Title === "string" && info.Title.trim()) {
    return info.Title.trim();
  }

  // Fall back to first non-empty line of text
  const firstLine = text.split(/[.\n]/).find((l) => l.trim().length > 5);
  if (firstLine && firstLine.trim().length < 200) {
    return firstLine.trim();
  }

  // Last resort: use filename without extension
  return filename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
}

function extractAuthors(
  info: Record<string, unknown> | undefined,
  text: string,
): string[] {
  // Try PDF metadata
  if (info?.Author && typeof info.Author === "string" && info.Author.trim()) {
    return info.Author.split(/[,;&]/)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  // Try to find author-like patterns in the first 500 chars
  const header = text.slice(0, 500);
  // Look for patterns like "Name1, Name2, and Name3" or "Name1 · Name2"
  const authorPattern = header.match(
    /(?:by\s+)?([A-Z][a-z]+ [A-Z][a-z]+(?:\s*[,&·]\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/,
  );
  if (authorPattern) {
    return authorPattern[1]
      .split(/[,&·]/)
      .map((a) => a.replace(/^\s*and\s+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function extractAbstract(text: string): string {
  // Look for an explicit "Abstract" section
  const abstractMatch = text.match(
    /\babstract\b[:\s]*(.{50,1500}?)(?:\b(?:introduction|keywords|1\s*\.?\s*introduction)\b)/i,
  );
  if (abstractMatch) {
    return abstractMatch[1].trim();
  }

  // Fall back to first ~500 chars of body text
  return text.slice(0, 500).trim();
}

/**
 * Convert an extracted PDF to the RawPaper format used by the feed pipeline.
 */
export function pdfToRawPaper(extracted: ExtractedPdf): RawPaper {
  // Try to extract year from text
  const yearMatch = extracted.text.match(/\b(20[0-2]\d|19[89]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  return {
    id: `pdf-${crypto.randomUUID()}`,
    title: extracted.title,
    abstract: extracted.abstract || extracted.text.slice(0, 2000),
    authors: extracted.authors,
    venue: "User Upload",
    year,
    doi: "",
    citationCount: 0,
    source: "pdf_upload",
  };
}
