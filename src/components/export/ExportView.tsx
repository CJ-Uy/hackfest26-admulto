"use client";

import { useState, useEffect } from "react";
import { fetchScroll } from "@/lib/scroll-store";
import { ExportActions } from "./ExportActions";
import type { ExportTheme, Paper } from "@/lib/types";

function generateMarkdownFromPapers(papers: Paper[]): string {
  if (papers.length === 0) return "";
  const lines: string[] = ["# Research Citations\n"];
  papers.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}\n`);
    lines.push(`**Authors:** ${p.authors.join(", ") || "N/A"}`);
    lines.push(`**Journal:** ${p.journal} (${p.year})`);
    lines.push(`**Credibility Score:** ${p.credibilityScore}/100`);
    lines.push(`**Citations:** ${p.citationCount}\n`);
    lines.push(`### Summary\n${p.synthesis}\n`);
    lines.push(`### Citation\n\`${p.apaCitation}\`\n`);
    if (p.doi) {
      const url = p.doi.startsWith("http") ? p.doi : `https://doi.org/${p.doi}`;
      lines.push(`[View Paper](${url})\n`);
    }
    lines.push("---\n");
  });
  return lines.join("\n");
}

function generateMarkdownFromOutline(themes: ExportTheme[]): string {
  return themes
    .map(
      (theme) =>
        `## ${theme.title}\n\n${theme.summary}\n\n### Sources\n\n${theme.sources
          .map(
            (s) =>
              `- **${s.title}** (${s.authors}, ${s.year})\n  Key finding: ${s.keyFinding}\n  \`${s.apaCitation}\``,
          )
          .join("\n\n")}`,
    )
    .join("\n\n---\n\n");
}

interface ExportViewProps {
  scrollId: string;
  papers: Paper[];
}

export function ExportView({ scrollId, papers }: ExportViewProps) {
  const [outline, setOutline] = useState<ExportTheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;
      if (stored && stored.exportOutline.length > 0) {
        setOutline(stored.exportOutline);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  if (loading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-[13px]">Loading...</p>
      </div>
    );
  }

  const hasOutline = outline.length > 0;
  const markdownText = hasOutline
    ? generateMarkdownFromOutline(outline)
    : generateMarkdownFromPapers(papers);

  if (!hasOutline && papers.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-[13px]">
          No export data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[12px]">
          {hasOutline
            ? "AI-generated research outline"
            : `${papers.length} papers collected`}
        </p>
        <ExportActions text={markdownText} />
      </div>

      {hasOutline ? (
        <div className="space-y-0">
          {outline.map((theme, i) => (
            <div
              key={theme.title}
              className={`py-4 ${i > 0 ? "border-border border-t" : ""}`}
            >
              <h2 className="font-heading text-foreground text-[15px] font-bold">
                {theme.title}
              </h2>
              <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                {theme.summary}
              </p>
              <div className="mt-3 space-y-2">
                {theme.sources.map((source) => (
                  <div
                    key={source.title}
                    className="border-border min-w-0 rounded-md border p-3"
                  >
                    <p className="text-foreground text-[13px] font-semibold">
                      {source.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[12px]">
                      {source.authors} ({source.year})
                    </p>
                    <p className="text-foreground mt-1.5 text-[13px]">
                      {source.keyFinding}
                    </p>
                    <p className="text-muted-foreground mt-1.5 rounded bg-[#f6f7f8] px-2 py-1 font-mono text-[11px] break-all">
                      {source.apaCitation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {papers.map((paper, i) => (
            <div
              key={paper.id}
              className={`py-4 ${i > 0 ? "border-border border-t" : ""}`}
            >
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-primary text-[12px] font-bold">
                  {i + 1}
                </span>
                <h2 className="font-heading text-foreground text-[14px] leading-snug font-bold">
                  {paper.title}
                </h2>
              </div>
              <p className="text-muted-foreground text-[12px]">
                {paper.authors.join(", ") || "Unknown"} &middot; {paper.journal}
                , {paper.year}
              </p>
              <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                {paper.synthesis}
              </p>
              <p className="text-muted-foreground mt-2 rounded bg-[#f6f7f8] px-2 py-1 font-mono text-[11px] break-all">
                {paper.apaCitation}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
