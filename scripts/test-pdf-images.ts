/**
 * Test script for the PDF image extraction pipeline.
 * Run with: npx tsx scripts/test-pdf-images.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { extractImages, getDocumentProxy } from "unpdf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const UPNG = require("upng-js") as {
  encode: (bufs: ArrayBuffer[], w: number, h: number, cnum: number) => ArrayBuffer;
};

const OUT_DIR = "/tmp/pdf-image-test";

// ── Step 1: Check OpenAlex for open-access URLs ────────────────────────────

async function checkOpenAlex(query: string) {
  console.log(`\n═══ STEP 1: OpenAlex open-access URLs for "${query}" ═══`);
  const params = new URLSearchParams({
    search: query,
    per_page: "5",
    select: "id,title,open_access",
    mailto: "test@example.com",
  });
  const res = await fetch(`https://api.openalex.org/works?${params}`);
  const data = (await res.json()) as { results: Record<string, unknown>[] };
  for (const r of data.results) {
    const oa = r.open_access as Record<string, unknown> | undefined;
    console.log(`  Title: ${String(r.title).slice(0, 60)}`);
    console.log(`  OA URL: ${oa?.oa_url ?? "(none)"}`);
    console.log(`  Is OA: ${oa?.is_oa}`);
    console.log();
  }
}

// ── Step 2: Check Semantic Scholar for open-access PDF URLs ───────────────

async function checkS2(query: string) {
  console.log(`\n═══ STEP 2: Semantic Scholar openAccessPdf for "${query}" ═══`);
  const params = new URLSearchParams({
    query,
    limit: "5",
    fields: "title,openAccessPdf",
  });
  const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`);
  const data = (await res.json()) as { data: Record<string, unknown>[] };
  for (const r of (data.data ?? [])) {
    console.log(`  Title: ${String(r.title).slice(0, 60)}`);
    console.log(`  PDF URL: ${(r.openAccessPdf as Record<string,string> | null)?.url ?? "(none)"}`);
    console.log();
  }
}

// ── Step 3: Fetch a PDF and try extractImages page by page ────────────────

async function testPdfExtraction(pdfUrl: string, label: string) {
  console.log(`\n═══ STEP 3: Extracting figures from [${label}] ═══`);
  console.log(`  URL: ${pdfUrl}`);

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(pdfUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/pdf" },
    });
    if (!res.ok) {
      console.log(`  ❌ HTTP ${res.status} fetching PDF`);
      return;
    }
    buffer = await res.arrayBuffer();
    console.log(`  ✅ Fetched ${(buffer.byteLength / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.log(`  ❌ Fetch failed: ${err}`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let foundAny = false;

  let proxy: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    proxy = await getDocumentProxy(new Uint8Array(buffer));
    console.log(`  📄 PDF has ${proxy.numPages} pages`);
  } catch (err) {
    console.log(`  ❌ getDocumentProxy failed: ${err}`);
    return;
  }

  const totalPages = Math.min(proxy.numPages, 5);
  for (let page = 1; page <= totalPages; page++) {
    let images: Awaited<ReturnType<typeof extractImages>>;
    try {
      images = await extractImages(proxy, page);
    } catch (err) {
      console.log(`  Page ${page}: extractImages threw — ${err}`);
      continue;
    }

    console.log(`  Page ${page}: ${images.length} image(s) found`);
    for (const img of images) {
      console.log(`    → ${img.width}×${img.height} ch=${img.channels} key=${img.key}`);

      if (img.width >= 200 && img.height >= 150) {
        foundAny = true;
        try {
          // Convert to RGBA
          const channels = img.channels;
          let rgbaBuffer: ArrayBuffer;
          if (channels === 4) {
            rgbaBuffer = new Uint8Array(img.data).buffer;
          } else {
            const pixels = img.data.length / channels;
            const rgba = new Uint8ClampedArray(pixels * 4);
            for (let i = 0; i < pixels; i++) {
              const src = i * channels;
              const dst = i * 4;
              if (channels === 1) {
                rgba[dst] = rgba[dst+1] = rgba[dst+2] = img.data[src];
              } else {
                rgba[dst] = img.data[src];
                rgba[dst+1] = img.data[src+1];
                rgba[dst+2] = img.data[src+2];
              }
              rgba[dst+3] = 255;
            }
            rgbaBuffer = rgba.buffer;
          }

          const png = UPNG.encode([rgbaBuffer], img.width, img.height, 0);
          const outPath = join(OUT_DIR, `${label.replace(/\W+/g, "_")}_p${page}_${img.key}.png`);
          writeFileSync(outPath, Buffer.from(png));
          console.log(`    ✅ Saved PNG → ${outPath}`);
        } catch (encErr) {
          console.log(`    ❌ PNG encode failed: ${encErr}`);
        }
      } else {
        console.log(`    ⚠️  Too small, skipping`);
      }
    }
  }

  if (!foundAny) {
    console.log(`  ⚠️  No qualifying images (≥200×150) found in first 5 pages`);
  }

  proxy.destroy();
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const topic = "machine learning transformers";

  await checkOpenAlex(topic);
  await checkS2(topic);

  // Known arXiv open-access PDFs (no .pdf suffix — the main bug we fixed)
  await testPdfExtraction("https://arxiv.org/pdf/1706.03762", "attention-is-all-you-need");
  await testPdfExtraction("https://arxiv.org/pdf/2303.08774", "gpt4-report");

  console.log(`\n═══ Done. Any saved PNGs are in ${OUT_DIR} ═══\n`);
}

main().catch(console.error);
