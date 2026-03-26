"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  List,
  FileText,
  Layers,
  Sparkles,
  ExternalLink,
  BookOpen,
  MessageSquareText,
  Copy,
  Check,
} from "lucide-react";
import { fetchScroll } from "@/lib/scroll-store";
import { ExportActions } from "./ExportActions";
import { ExportPromptQuiz } from "./ExportPromptQuiz";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExportTheme, Paper, LitReviewExport, PaperTier } from "@/lib/types";

type ExportMode = "references" | "with-summaries" | "themed" | "literature-review" | "research-prompt";

const MODES: {
  value: ExportMode;
  label: string;
  desc: string;
  icon: typeof List;
}[] = [
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
  {
    value: "literature-review",
    label: "Literature Review",
    desc: "AI-generated review weighted by your interactions",
    icon: BookOpen,
  },
  {
    value: "research-prompt",
    label: "Research Prompt",
    desc: "Ready-to-paste prompt for your own AI assistant",
    icon: MessageSquareText,
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

const TIER_LABELS: Record<PaperTier, string> = {
  core: "Core",
  supporting: "Supporting",
  peripheral: "Peripheral",
};

function generateMarkdownLitReview(data: LitReviewExport): string {
  const lines: string[] = ["# Literature Review\n"];
  lines.push(`## Introduction\n\n${data.introduction}\n`);
  lines.push("---\n");
  data.sections.forEach((section) => {
    lines.push(`## ${section.title}\n`);
    lines.push(`${section.content}\n`);
    if (section.papers.length > 0) {
      lines.push("**Sources:**\n");
      section.papers.forEach((p) => {
        lines.push(`- [${TIER_LABELS[p.tier]}] ${p.apaCitation}`);
      });
      lines.push("");
    }
    lines.push("---\n");
  });
  lines.push(`## Conclusion\n\n${data.conclusion}\n`);
  lines.push("---\n");
  lines.push("## References\n");
  data.references.forEach((r) => {
    lines.push(`- [${TIER_LABELS[r.tier]}] ${r.apaCitation}`);
  });
  lines.push("");
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
  const [litReviewData, setLitReviewData] = useState<LitReviewExport | null>(null);
  const [promptData, setPromptData] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [scopingAnswers, setScopingAnswers] = useState<Record<string, string> | null>(null);

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

  // Fetch research prompt after quiz is completed (or skipped)
  useEffect(() => {
    if (mode !== "research-prompt" || !quizCompleted || promptData || loadingPrompt) return;
    let cancelled = false;
    setLoadingPrompt(true);
    fetch("/api/export-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrollId, scopingAnswers: scopingAnswers ?? undefined }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPromptData((data as { prompt: string }).prompt);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate research prompt.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrompt(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, quizCompleted, scrollId, promptData]);

  async function handleGenerateAI(selectedMode: "with-summaries" | "themed" | "literature-review") {
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
      } else if (selectedMode === "literature-review") {
        setLitReviewData(data as LitReviewExport);
      } else {
        setThemedData(data as ThemedExport);
      }
      toast.success(selectedMode === "literature-review" ? "Literature review generated!" : "AI summaries generated!");
    } catch {
      toast.error("Failed to generate. Try again.");
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
  } else if (mode === "literature-review" && litReviewData) {
    markdownText = generateMarkdownLitReview(litReviewData);
  } else if (mode === "research-prompt" && promptData) {
    markdownText = promptData;
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
    (mode === "themed" && !themedData && outline.length === 0) ||
    (mode === "literature-review" && !litReviewData);

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
          onClick={() => handleGenerateAI(mode as "with-summaries" | "themed" | "literature-review")}
          disabled={generatingAI}
          className="text-primary hover:bg-primary/5 border-primary mb-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {generatingAI ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "literature-review" ? "Generating literature review..." : "Generating AI summaries..."}
            </>
          ) : (
            <>
              {mode === "literature-review" ? <BookOpen className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {mode === "literature-review" ? "Generate Literature Review" : "Generate AI Summaries"}
            </>
          )}
        </button>
      )}

      {/* Export actions */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[12px]">
          {mode === "references"
            ? `${papers.length} papers collected`
            : mode === "research-prompt" && promptData
              ? "Research prompt ready — copy and paste into your AI"
              : mode === "research-prompt" && loadingPrompt
                ? "Building research prompt..."
                : mode === "with-summaries" && summaryData
                  ? "AI-enhanced reference list"
                  : mode === "literature-review" && litReviewData
                    ? "Behavior-aware literature review"
                    : mode === "themed" && (themedData || outline.length > 0)
                      ? "AI-organized research outline"
                      : `${papers.length} papers — generate ${mode === "literature-review" ? "literature review" : "AI summaries"} above`}
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
              <p className="text-muted-foreground bg-subtle mt-2 rounded px-2 py-1 font-mono text-[11px] break-all">
                {paper.apaCitation}
              </p>
            </div>
          ))}
        </div>
      )}

      {mode === "with-summaries" && summaryData && (
        <div className="space-y-0">
          {/* Overall summary */}
          <div className="border-primary/20 bg-primary/5 mb-4 rounded-lg border p-4">
            <h3 className="text-foreground mb-1.5 text-[13px] font-bold">
              Overall Research Summary
            </h3>
            <p className="text-foreground text-[13px] leading-relaxed">
              {summaryData.overallSummary}
            </p>
          </div>

          {summaryData.papers.map((paper, i) => (
            <div
              key={`${paper.title}-${i}`}
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
              <p className="text-muted-foreground bg-subtle mt-2 rounded px-2 py-1 font-mono text-[11px] break-all">
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
                <div className="border-primary/20 bg-primary/5 mb-4 rounded-lg border p-4">
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
                  key={`${theme.title}-${i}`}
                  className={`py-4 ${i > 0 ? "border-border border-t" : ""}`}
                >
                  <h2 className="font-heading text-foreground text-[15px] font-bold">
                    {theme.title}
                  </h2>
                  <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                    {theme.summary}
                  </p>
                  <div className="mt-3 space-y-2">
                    {theme.sources.map((source, si) => (
                      <div
                        key={`${source.title}-${si}`}
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
                        <p className="text-muted-foreground bg-subtle mt-1.5 rounded px-2 py-1 font-mono text-[11px] break-all">
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

      {/* Literature review rendering */}
      {mode === "literature-review" && litReviewData && (
        <div className="space-y-0">
          {/* Introduction */}
          <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
            <h3 className="text-foreground mb-1.5 text-[13px] font-bold">
              Introduction
            </h3>
            <p className="text-foreground text-[13px] leading-relaxed">
              {litReviewData.introduction}
            </p>
          </div>

          {/* Sections */}
          {litReviewData.sections.map((section, i) => (
            <div
              key={`${section.title}-${i}`}
              className={`py-4 ${i > 0 ? "border-border border-t" : ""}`}
            >
              <h2 className="font-heading text-foreground text-[15px] font-bold">
                {section.title}
              </h2>
              <p className="text-foreground mt-1.5 text-[13px] leading-relaxed">
                {section.content}
              </p>
              <div className="mt-3 space-y-1.5">
                {section.papers.map((p, pi) => (
                  <div
                    key={`${p.title}-${pi}`}
                    className="flex items-start gap-2"
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        p.tier === "core"
                          ? "bg-primary/15 text-primary"
                          : p.tier === "supporting"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.tier}
                    </span>
                    <p className="text-muted-foreground font-mono text-[11px] break-all">
                      {p.apaCitation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Conclusion */}
          <div className="border-border border-t py-4">
            <h3 className="text-foreground mb-1.5 text-[13px] font-bold">
              Conclusion
            </h3>
            <p className="text-foreground text-[13px] leading-relaxed">
              {litReviewData.conclusion}
            </p>
          </div>

          {/* References */}
          <div className="border-border border-t py-4">
            <h3 className="text-foreground mb-2 text-[13px] font-bold">
              References
            </h3>
            <div className="space-y-1.5">
              {litReviewData.references.map((ref, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      ref.tier === "core"
                        ? "bg-primary/15 text-primary"
                        : ref.tier === "supporting"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {ref.tier}
                  </span>
                  <p className="text-muted-foreground font-mono text-[11px] break-all">
                    {ref.apaCitation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Research prompt — quiz then prompt */}
      {mode === "research-prompt" && !quizCompleted && !promptData && !loadingPrompt && (
        <ExportPromptQuiz
          scrollId={scrollId}
          onComplete={(answers) => {
            setScopingAnswers(answers);
            setQuizCompleted(true);
          }}
          onSkip={() => {
            setScopingAnswers(null);
            setQuizCompleted(true);
          }}
        />
      )}

      {mode === "research-prompt" && loadingPrompt && (
        <div className="px-4 py-8 text-center">
          <Loader2 className="text-muted-foreground mx-auto mb-2 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Building your research prompt...
          </p>
        </div>
      )}

      {mode === "research-prompt" && promptData && !loadingPrompt && (
        <div className="space-y-3">
          <div className="border-border bg-subtle relative rounded-lg border p-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(promptData);
                setPromptCopied(true);
                toast.success("Prompt copied to clipboard!");
                setTimeout(() => setPromptCopied(false), 2000);
              }}
              className="bg-background border-border hover:bg-muted absolute right-2 top-2 rounded-md border p-1.5 transition-colors"
            >
              {promptCopied ? (
                <Check className="text-primary h-4 w-4" />
              ) : (
                <Copy className="text-muted-foreground h-4 w-4" />
              )}
            </button>
            <pre className="text-foreground whitespace-pre-wrap text-[13px] leading-relaxed">
              {promptData}
            </pre>
          </div>
          <button
            onClick={() => {
              setQuizCompleted(false);
              setPromptData(null);
              setScopingAnswers(null);
            }}
            className="text-muted-foreground hover:text-foreground text-[12px] transition-colors"
          >
            Re-scope prompt
          </button>
        </div>
      )}

      {/* Show prompt to generate if AI mode selected but no data */}
      {((mode === "with-summaries" && !summaryData) ||
        (mode === "themed" && !themedData && outline.length === 0) ||
        (mode === "literature-review" && !litReviewData)) &&
        !generatingAI && (
          <div className="px-4 py-8 text-center">
            {mode === "literature-review" ? (
              <BookOpen className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            ) : (
              <Sparkles className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            )}
            <p className="text-muted-foreground text-sm">
              {mode === "literature-review"
                ? <>Click &ldquo;Generate Literature Review&rdquo; above to create a behavior-aware review.</>
                : <>Click &ldquo;Generate AI Summaries&rdquo; above to create this export.</>}
            </p>
          </div>
        )}
    </div>
  );
}
