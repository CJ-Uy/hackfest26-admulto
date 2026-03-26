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
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { fetchScroll } from "@/lib/scroll-store";
import { ExportActions } from "./ExportActions";
import { ExportPromptQuiz } from "./ExportPromptQuiz";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  ExportTheme,
  Paper,
  LitReviewExport,
  PaperTier,
} from "@/lib/types";

type ExportMode =
  | "references"
  | "with-summaries"
  | "themed"
  | "literature-review"
  | "research-prompt";

const MODES: {
  value: ExportMode;
  label: string;
  desc: string;
  icon: typeof List;
  needsAI: boolean;
}[] = [
  {
    value: "references",
    label: "References",
    desc: "Numbered bibliography",
    icon: List,
    needsAI: false,
  },
  {
    value: "with-summaries",
    label: "Summaries",
    desc: "AI-enhanced references",
    icon: FileText,
    needsAI: true,
  },
  {
    value: "themed",
    label: "Themed",
    desc: "Grouped by topic",
    icon: Layers,
    needsAI: true,
  },
  {
    value: "literature-review",
    label: "Lit Review",
    desc: "Full review",
    icon: BookOpen,
    needsAI: true,
  },
  {
    value: "research-prompt",
    label: "Prompt",
    desc: "For your AI",
    icon: MessageSquareText,
    needsAI: false,
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
  const [litReviewData, setLitReviewData] = useState<LitReviewExport | null>(
    null,
  );
  const [promptData, setPromptData] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [scopingAnswers, setScopingAnswers] = useState<Record<
    string,
    string
  > | null>(null);

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
    if (
      mode !== "research-prompt" ||
      !quizCompleted ||
      promptData ||
      loadingPrompt
    )
      return;
    let cancelled = false;
    setLoadingPrompt(true);
    fetch("/api/export-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scrollId,
        scopingAnswers: scopingAnswers ?? undefined,
      }),
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

  async function handleGenerateAI(
    selectedMode: "with-summaries" | "themed" | "literature-review",
  ) {
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
      toast.success(
        selectedMode === "literature-review"
          ? "Literature review generated!"
          : "AI summaries generated!",
      );
    } catch {
      toast.error("Failed to generate. Try again.");
    } finally {
      setGeneratingAI(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No papers available to export yet.
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

  const currentMode = MODES.find((m) => m.value === mode)!;

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-6">
      {/* Mode selector — horizontal scroll on mobile, wrapped on desktop */}
      <div className="mb-5">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-left transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="text-[13px] font-medium whitespace-nowrap">
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2.5 text-[13px]">
          {currentMode.desc}
        </p>
      </div>

      {/* Generate AI button — prominent CTA when needed */}
      {needsGeneration && !generatingAI && (
        <button
          onClick={() =>
            handleGenerateAI(
              mode as "with-summaries" | "themed" | "literature-review",
            )
          }
          className="group bg-primary text-primary-foreground hover:bg-primary/90 mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-[14px] font-semibold shadow-sm transition-all duration-200 active:scale-[0.98]"
        >
          {mode === "literature-review" ? (
            <BookOpen className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {mode === "literature-review"
            ? "Generate Literature Review"
            : "Generate AI Summaries"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {generatingAI && (
        <div className="bg-muted/50 mb-5 flex items-center justify-center gap-2.5 rounded-xl px-5 py-4">
          <Loader2 className="text-primary h-4 w-4 animate-spin" />
          <span className="text-foreground text-[14px] font-medium">
            {mode === "literature-review"
              ? "Generating literature review..."
              : "Generating AI summaries..."}
          </span>
        </div>
      )}

      {/* Export actions bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[13px]">
          {mode === "references"
            ? `${papers.length} papers collected`
            : mode === "research-prompt" && promptData
              ? "Research prompt ready"
              : mode === "research-prompt" && loadingPrompt
                ? "Building research prompt..."
                : mode === "with-summaries" && summaryData
                  ? "AI-enhanced reference list"
                  : mode === "literature-review" && litReviewData
                    ? "Behavior-aware literature review"
                    : mode === "themed" && (themedData || outline.length > 0)
                      ? "AI-organized research outline"
                      : `${papers.length} papers available`}
        </p>
        <ExportActions text={markdownText} papers={papers} />
      </div>

      {/* Content rendering */}
      {mode === "references" && (
        <div className="divide-border divide-y">
          {papers.map((paper, i) => (
            <div key={paper.id} className="py-4 first:pt-0">
              <div className="mb-1.5 flex items-start gap-3">
                <span className="bg-muted text-muted-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-foreground text-[15px] leading-snug font-semibold">
                    {paper.title}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-[13px]">
                    {paper.authors.join(", ") || "Unknown"} &middot;{" "}
                    {paper.journal}, {paper.year}
                  </p>
                </div>
              </div>
              <div className="ml-9">
                <p className="text-muted-foreground border-border/60 bg-muted/40 rounded-lg border px-3 py-2 font-mono text-[12px] leading-relaxed break-all">
                  {paper.apaCitation}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "with-summaries" && summaryData && (
        <div className="space-y-5">
          {/* Overall summary */}
          <div className="border-primary/20 bg-primary/5 rounded-xl border-l-[3px] py-4 pr-4 pl-5">
            <h3 className="text-foreground mb-2 text-[14px] font-bold tracking-tight">
              Overall Research Summary
            </h3>
            <p className="text-foreground/85 text-[14px] leading-relaxed">
              {summaryData.overallSummary}
            </p>
          </div>

          <div className="divide-border divide-y">
            {summaryData.papers.map((paper, i) => (
              <div key={`${paper.title}-${i}`} className="py-4 first:pt-0">
                <div className="mb-1.5 flex items-start gap-3">
                  <span className="bg-muted text-muted-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-foreground text-[15px] leading-snug font-semibold">
                      {paper.title}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-[13px]">
                      {paper.authors.join(", ") || "Unknown"} ({paper.year})
                    </p>
                  </div>
                </div>
                <div className="ml-9 space-y-2">
                  <div className="bg-primary/5 rounded-lg px-3.5 py-2.5">
                    <p className="text-foreground text-[13px] leading-relaxed">
                      {paper.aiSummary}
                    </p>
                  </div>
                  <p className="text-muted-foreground border-border/60 bg-muted/40 rounded-lg border px-3 py-2 font-mono text-[12px] leading-relaxed break-all">
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
                      className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Paper
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "themed" &&
        (themedData || outline.length > 0) &&
        (() => {
          const themes = themedData?.themes ?? outline;
          const overallSummary = themedData?.overallSummary;

          return (
            <div className="space-y-5">
              {overallSummary && (
                <div className="border-primary/20 bg-primary/5 rounded-xl border-l-[3px] py-4 pr-4 pl-5">
                  <h3 className="text-foreground mb-2 text-[14px] font-bold tracking-tight">
                    Overall Research Summary
                  </h3>
                  <p className="text-foreground/85 text-[14px] leading-relaxed">
                    {overallSummary}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {themes.map((theme, i) => (
                  <div key={`${theme.title}-${i}`}>
                    <h2 className="text-foreground mb-1.5 text-[16px] font-bold tracking-tight">
                      {theme.title}
                    </h2>
                    <p className="text-muted-foreground mb-3 text-[14px] leading-relaxed">
                      {theme.summary}
                    </p>
                    <div className="space-y-2.5">
                      {theme.sources.map((source, si) => (
                        <div
                          key={`${source.title}-${si}`}
                          className="border-border/60 bg-muted/30 rounded-xl border p-4"
                        >
                          <p className="text-foreground text-[14px] leading-snug font-semibold">
                            {source.title}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[13px]">
                            {source.authors} ({source.year})
                          </p>
                          <p className="text-foreground/80 mt-2 text-[13px] leading-relaxed">
                            {source.keyFinding}
                          </p>
                          <p className="text-muted-foreground border-border/60 bg-muted/40 mt-2.5 rounded-lg border px-3 py-2 font-mono text-[12px] break-all">
                            {source.apaCitation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      {/* Literature review rendering */}
      {mode === "literature-review" && litReviewData && (
        <div className="space-y-5">
          {/* Introduction */}
          <div className="border-primary/20 bg-primary/5 rounded-xl border-l-[3px] py-4 pr-4 pl-5">
            <h3 className="text-foreground mb-2 text-[14px] font-bold tracking-tight">
              Introduction
            </h3>
            <p className="text-foreground/85 text-[14px] leading-relaxed">
              {litReviewData.introduction}
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {litReviewData.sections.map((section, i) => (
              <div key={`${section.title}-${i}`}>
                <h2 className="text-foreground mb-1.5 text-[16px] font-bold tracking-tight">
                  {section.title}
                </h2>
                <p className="text-foreground/85 mb-3 text-[14px] leading-relaxed">
                  {section.content}
                </p>
                <div className="space-y-1.5">
                  {section.papers.map((p, pi) => (
                    <div
                      key={`${p.title}-${pi}`}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                          p.tier === "core"
                            ? "bg-primary/15 text-primary"
                            : p.tier === "supporting"
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.tier}
                      </span>
                      <p className="text-muted-foreground font-mono text-[12px] leading-relaxed break-all">
                        {p.apaCitation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Conclusion */}
          <div className="border-border border-t pt-5">
            <h3 className="text-foreground mb-2 text-[14px] font-bold tracking-tight">
              Conclusion
            </h3>
            <p className="text-foreground/85 text-[14px] leading-relaxed">
              {litReviewData.conclusion}
            </p>
          </div>

          {/* References */}
          <div className="border-border border-t pt-5">
            <h3 className="text-foreground mb-3 text-[14px] font-bold tracking-tight">
              References
            </h3>
            <div className="space-y-1.5">
              {litReviewData.references.map((ref, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                      ref.tier === "core"
                        ? "bg-primary/15 text-primary"
                        : ref.tier === "supporting"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {ref.tier}
                  </span>
                  <p className="text-muted-foreground font-mono text-[12px] leading-relaxed break-all">
                    {ref.apaCitation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Research prompt — quiz then prompt */}
      {mode === "research-prompt" &&
        !quizCompleted &&
        !promptData &&
        !loadingPrompt && (
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
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <Loader2 className="text-primary mb-3 h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-[14px]">
            Building your research prompt...
          </p>
        </div>
      )}

      {mode === "research-prompt" && promptData && !loadingPrompt && (
        <div className="space-y-3">
          <div className="border-border/60 bg-muted/30 relative overflow-hidden rounded-xl border">
            <div className="border-border/60 flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-muted-foreground text-[12px] font-medium">
                Research Prompt
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(promptData);
                  setPromptCopied(true);
                  toast.success("Prompt copied to clipboard!");
                  setTimeout(() => setPromptCopied(false), 2000);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all",
                  promptCopied
                    ? "bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground border",
                )}
              >
                {promptCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="text-foreground overflow-x-auto p-4 text-[13px] leading-relaxed whitespace-pre-wrap sm:p-5">
              {promptData}
            </pre>
          </div>
          <button
            onClick={() => {
              setQuizCompleted(false);
              setPromptData(null);
              setScopingAnswers(null);
            }}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            Re-scope prompt
          </button>
        </div>
      )}

      {/* Empty state for AI modes */}
      {((mode === "with-summaries" && !summaryData) ||
        (mode === "themed" && !themedData && outline.length === 0) ||
        (mode === "literature-review" && !litReviewData)) &&
        !generatingAI && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="bg-muted/60 mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              {mode === "literature-review" ? (
                <BookOpen className="text-muted-foreground h-5 w-5" />
              ) : (
                <Sparkles className="text-muted-foreground h-5 w-5" />
              )}
            </div>
            <p className="text-muted-foreground max-w-[240px] text-[14px] leading-relaxed">
              {mode === "literature-review"
                ? "Generate a behavior-aware literature review from your papers."
                : "Generate AI summaries to create this export."}
            </p>
          </div>
        )}
    </div>
  );
}
