"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  List,
  FileText,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { fetchScroll } from "@/lib/scroll-store";
import { ExportActions } from "./ExportActions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExportTheme, Paper } from "@/lib/types";

type ExportMode = "references" | "with-summaries" | "themed";

const MODES: { value: ExportMode; label: string; desc: string; icon: typeof List }[] = [
  {
    value: "references",
    label: "Reference List",
    desc: "Simple numbered bibliography",
    icon: List,
  },
  {
    value: "with-summaries",
    label: "With AI Summaries",
    desc: "References + per-paper and overall AI summary",
    icon: FileText,
  },
  {
    value: "themed",
    label: "Themed & Grouped",
    desc: "AI-organized by themes with section summaries",
    icon: Layers,
  },
];

interface SummarizedPaper {
  title: string;
  authors: string[];
  year: number;
  apaCitation: string;
  doi: string;
  synthesis: string;
  credibilityScore: number;
  citationCount: number;
  aiSummary: string;
}

interface ThemedExport {
  overallSummary: string;
  themes: Array<{
    title: string;
    summary: string;
    sources: Array<{
      title: string;
      authors: string;
      year: number;
      keyFinding: string;
      apaCitation: string;
    }>;
  }>;
}

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

function generateMarkdownWithSummaries(
  overallSummary: string,
  papers: SummarizedPaper[],
): string {
  const lines: string[] = ["# Research Summary\n"];
  lines.push(`## Overall Summary\n\n${overallSummary}\n`);
  lines.push("---\n");
  lines.push("## References\n");
  papers.forEach((p, i) => {
    lines.push(`### ${i + 1}. ${p.title}\n`);
    lines.push(`**AI Summary:** ${p.aiSummary}\n`);
    lines.push(`\`${p.apaCitation}\`\n`);
    if (p.doi) {
      const url = p.doi.startsWith("http") ? p.doi : `https://doi.org/${p.doi}`;
      lines.push(`[View Paper](${url})\n`);
    }
    lines.push("---\n");
  });
  return lines.join("\n");
}

function generateMarkdownThemed(data: ThemedExport): string {
  const lines: string[] = ["# Research Summary\n"];
  lines.push(`## Overall Summary\n\n${data.overallSummary}\n`);
  lines.push("---\n");
  data.themes.forEach((theme) => {
    lines.push(`## ${theme.title}\n`);
    lines.push(`${theme.summary}\n`);
    lines.push("### Sources\n");
    theme.sources.forEach((s) => {
      lines.push(
        `- **${s.title}** (${s.authors}, ${s.year})\n  Key finding: ${s.keyFinding}\n  \`${s.apaCitation}\`\n`,
      );
    });
    lines.push("---\n");
  });
  return lines.join("\n");
}

interface ExportViewProps {
  scrollId: string;
  papers: Paper[];
}

export function ExportView({ scrollId, papers }: ExportViewProps) {
  const [mode, setMode] = useState<ExportMode>("references");
  const [outline, setOutline] = useState<ExportTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);

  // AI summary data
  const [summaryData, setSummaryData] = useState<{
    overallSummary: string;
    papers: SummarizedPaper[];
  } | null>(null);
  const [themedData, setThemedData] = useState<ThemedExport | null>(null);

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

  async function handleGenerateAI(selectedMode: "with-summaries" | "themed") {
    if (generatingAI) return;
    setGeneratingAI(true);

    try {
      const res = await fetch("/api/export-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollId, mode: selectedMode }),
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (selectedMode === "with-summaries") {
        setSummaryData(data as typeof summaryData);
      } else {
        setThemedData(data as ThemedExport);
      }
      toast.success("AI summaries generated!");
    } catch {
      toast.error("Failed to generate summaries. Try again.");
    } finally {
      setGeneratingAI(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-[13px]">Loading...</p>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-[13px]">
          No export data available yet.
        </p>
      </div>
    );
  }

  // Determine current markdown text for export actions
  let markdownText: string;
  if (mode === "with-summaries" && summaryData) {
    markdownText = generateMarkdownWithSummaries(
      summaryData.overallSummary,
      summaryData.papers,
    );
  } else if (mode === "themed" && themedData) {
    markdownText = generateMarkdownThemed(themedData);
  } else if (mode === "themed" && outline.length > 0) {
    markdownText = generateMarkdownThemed({
      overallSummary: "",
      themes: outline.map((t) => ({
        title: t.title,
        summary: t.summary,
        sources: t.sources,
      })),
    });
  } else {
    markdownText = generateMarkdownFromPapers(papers);
  }

  const needsGeneration =
    (mode === "with-summaries" && !summaryData) ||
    (mode === "themed" && !themedData && outline.length === 0);

  return (
    <div className="px-4 py-4">
      {/* Mode selector */}
      <div className="mb-4 space-y-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                mode === m.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  mode === m.value ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-muted-foreground text-xs">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Generate AI summaries button (if needed) */}
      {needsGeneration && (
        <button
          onClick={() =>
            handleGenerateAI(mode as "with-summaries" | "themed")
          }
          disabled={generatingAI}
          className="text-primary hover:bg-primary/5 border-primary mb-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {generatingAI ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating AI summaries...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate AI Summaries
            </>
          )}
        </button>
      )}

      {/* Export actions */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[12px]">
          {mode === "references"
            ? `${papers.length} papers collected`
            : mode === "with-summaries" && summaryData
              ? "AI-enhanced reference list"
              : mode === "themed" && (themedData || outline.length > 0)
                ? "AI-organized research outline"
                : `${papers.length} papers — generate AI summaries above`}
        </p>
        <ExportActions text={markdownText} papers={papers} />
      </div>

      {/* Content rendering */}
      {mode === "references" && (
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
              <p className="text-muted-foreground mt-2 rounded bg-subtle px-2 py-1 font-mono text-[11px] break-all">
                {paper.apaCitation}
              </p>
            </div>
          ))}
        </div>
      )}

      {mode === "with-summaries" && summaryData && (
        <div className="space-y-0">
          {/* Overall summary */}
          <div className="border-primary/20 mb-4 rounded-lg border bg-primary/5 p-4">
            <h3 className="text-foreground mb-1.5 text-[13px] font-bold">
              Overall Research Summary
            </h3>
            <p className="text-foreground text-[13px] leading-relaxed">
              {summaryData.overallSummary}
            </p>
          </div>

          {summaryData.papers.map((paper, i) => (
            <div
              key={paper.title}
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
                {paper.authors.join(", ") || "Unknown"} ({paper.year})
              </p>
              <div className="bg-primary/5 mt-2 rounded-md px-3 py-2">
                <p className="text-foreground text-[12px] leading-relaxed">
                  <span className="text-primary font-semibold">
                    AI Summary:{" "}
                  </span>
                  {paper.aiSummary}
                </p>
              </div>
              <p className="text-muted-foreground mt-2 rounded bg-subtle px-2 py-1 font-mono text-[11px] break-all">
                {paper.apaCitation}
              </p>
              {paper.doi && (
                <a
                  href={
                    paper.doi.startsWith("http")
                      ? paper.doi
                      : `https://doi.org/${paper.doi}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-1 inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  View Paper
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === "themed" &&
        (themedData || outline.length > 0) &&
        (() => {
          const themes = themedData?.themes ?? outline;
          const overallSummary = themedData?.overallSummary;

          return (
            <div className="space-y-0">
              {overallSummary && (
                <div className="border-primary/20 mb-4 rounded-lg border bg-primary/5 p-4">
                  <h3 className="text-foreground mb-1.5 text-[13px] font-bold">
                    Overall Research Summary
                  </h3>
                  <p className="text-foreground text-[13px] leading-relaxed">
                    {overallSummary}
                  </p>
                </div>
              )}

              {themes.map((theme, i) => (
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
                        <p className="text-muted-foreground mt-1.5 rounded bg-subtle px-2 py-1 font-mono text-[11px] break-all">
                          {source.apaCitation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

      {/* Show prompt to generate if AI mode selected but no data */}
      {((mode === "with-summaries" && !summaryData) ||
        (mode === "themed" && !themedData && outline.length === 0)) &&
        !generatingAI && (
          <div className="px-4 py-8 text-center">
            <Sparkles className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Click &ldquo;Generate AI Summaries&rdquo; above to create this
              export.
            </p>
          </div>
        )}
    </div>
  );
}
