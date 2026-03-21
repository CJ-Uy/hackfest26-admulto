"use client";

import { useState, useEffect, useRef } from "react";
import { Search, FileText, Sparkles, CheckCircle2, BookOpen } from "lucide-react";

interface ProgressInfo {
  step: string;
  papersProcessed?: number;
  total?: number;
  message?: string;
}

interface GenerationProgressProps {
  progress: ProgressInfo | null;
  topic: string;
  hasPdfs?: boolean;
}

const STEPS = [
  {
    key: "extracting",
    label: "Extracting PDFs",
    detail: "Reading text from your uploaded documents",
    icon: FileText,
    pdfOnly: true,
  },
  {
    key: "searching",
    label: "Searching databases",
    detail: "Querying Semantic Scholar & web sources",
    icon: Search,
  },
  {
    key: "processing",
    label: "Analyzing papers",
    detail: "Generating AI syntheses & verifying claims",
    icon: FileText,
  },
  {
    key: "exporting",
    label: "Organizing research",
    detail: "Building themes & generating discussion",
    icon: Sparkles,
  },
  {
    key: "complete",
    label: "Ready",
    detail: "Your feed is ready to explore",
    icon: CheckCircle2,
  },
];

const FUN_FACTS = [
  "Over 2.5 million new scientific papers are published every year.",
  "The average research paper has around 45 references.",
  "Peer review as we know it only became standard in the mid-20th century.",
  "The most cited paper of all time has over 300,000 citations.",
  "A scientist reads about 250 papers per year on average.",
  "The first academic journal was published in 1665.",
  "Preprint servers have grown 30x in the last decade.",
  "Cross-disciplinary papers tend to have higher long-term impact.",
  "The h-index was invented by physicist Jorge Hirsch in 2005.",
  "About 72% of published papers are never cited by another paper.",
  "The word 'research' comes from the French 'recherche', meaning to search closely.",
  "Nature and Science have rejection rates above 90%.",
];

export function GenerationProgress({ progress, topic, hasPdfs }: GenerationProgressProps) {
  const visibleSteps = hasPdfs
    ? STEPS
    : STEPS.filter((s) => !(s as { pdfOnly?: boolean }).pdfOnly);
  const currentStepIdx = visibleSteps.findIndex((s) => s.key === (progress?.step || "searching"));
  const effectiveIdx = currentStepIdx >= 0 ? currentStepIdx : 0;
  const [factIndex, setFactIndex] = useState(() =>
    Math.floor(Math.random() * FUN_FACTS.length),
  );
  const [factVisible, setFactVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  // Rotate fun facts every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
        setFactVisible(true);
      }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;

  // Paper processing sub-progress
  const papersProcessed = progress?.papersProcessed ?? 0;
  const totalPapers = progress?.total ?? 0;
  const showPaperCount = progress?.step === "processing" && totalPapers > 0;

  return (
    <div className="mt-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <div className="relative h-2 w-2">
            <div className="absolute inset-0 rounded-full bg-primary animate-ping" />
            <div className="relative rounded-full h-2 w-2 bg-primary" />
          </div>
          Generating your feed
        </div>
        <p className="text-muted-foreground text-sm">
          Researching <span className="text-foreground font-medium">&ldquo;{topic}&rdquo;</span>
        </p>
      </div>

      {/* Step indicators */}
      <div className="space-y-3">
        {visibleSteps.slice(0, -1).map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === effectiveIdx;
          const isDone = idx < effectiveIdx;
          const isPending = idx > effectiveIdx;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-500 ${
                isActive
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : isDone
                    ? "border-border/50 bg-muted/30"
                    : "border-transparent opacity-40"
              }`}
            >
              {/* Icon */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-500 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isPending ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.label}
                  {isDone && (
                    <span className="text-primary ml-2 text-xs font-normal">Done</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs truncate">
                  {step.detail}
                </p>
              </div>

              {/* Paper count badge */}
              {isActive && showPaperCount && (
                <div className="shrink-0 tabular-nums text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
                  {papersProcessed}/{totalPapers}
                </div>
              )}

              {/* Active spinner */}
              {isActive && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
            style={{ width: `${getProgressPercent(progress)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{getProgressPercent(progress)}%</span>
          <span>{timeStr} elapsed</span>
        </div>
      </div>

      {/* Fun fact card */}
      <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-3">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Did you know?
            </p>
            <p
              className={`text-sm text-foreground/80 transition-opacity duration-400 ${
                factVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {FUN_FACTS[factIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getProgressPercent(progress: ProgressInfo | null): number {
  if (!progress) return 5;
  switch (progress.step) {
    case "extracting":
      return 8;
    case "searching":
      return 15;
    case "processing": {
      const base = 20;
      const range = 60;
      if (progress.total && progress.total > 0) {
        return Math.round(
          base + (range * (progress.papersProcessed ?? 0)) / progress.total,
        );
      }
      return base;
    }
    case "exporting":
      return 85;
    default:
      return 5;
  }
}
