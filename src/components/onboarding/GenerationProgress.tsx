"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  FileText,
  Sparkles,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

interface ProgressInfo {
  step: string;
  papersProcessed?: number;
  total?: number;
  message?: string;
  debug?: string;
}

interface GenerationProgressProps {
  progress: ProgressInfo | null;
  topic: string;
  hasPdfs?: boolean;
}

const STEPS = [
  {
    key: "queued",
    label: "Starting up",
    detail: "Initializing background processing",
    icon: Search,
  },
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

export function GenerationProgress({
  progress,
  topic,
  hasPdfs,
}: GenerationProgressProps) {
  const visibleSteps = hasPdfs
    ? STEPS
    : STEPS.filter((s) => !(s as { pdfOnly?: boolean }).pdfOnly);
  const currentStepIdx = visibleSteps.findIndex(
    (s) => s.key === (progress?.step || "searching"),
  );
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
  const timeStr =
    minutes > 0
      ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
      : `${seconds}s`;

  // Paper processing sub-progress
  const papersProcessed = progress?.papersProcessed ?? 0;
  const totalPapers = progress?.total ?? 0;
  const showPaperCount = progress?.step === "processing" && totalPapers > 0;

  return (
    <div className="animate-in fade-in mt-8 space-y-8 duration-500">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
          <div className="relative h-2 w-2">
            <div className="bg-primary absolute inset-0 animate-ping rounded-full" />
            <div className="bg-primary relative h-2 w-2 rounded-full" />
          </div>
          Generating your feed
        </div>
        <p className="text-muted-foreground text-sm">
          Researching{" "}
          <span className="text-foreground font-medium">
            &ldquo;{topic}&rdquo;
          </span>
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
                  <Icon
                    className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`}
                  />
                )}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p
                  className={`min-w-0 truncate text-sm font-medium ${
                    isPending ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.label}
                  {isDone && (
                    <span className="text-primary ml-2 text-xs font-normal">
                      Done
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {step.detail}
                </p>
              </div>

              {/* Paper count badge */}
              {isActive && showPaperCount && (
                <div className="text-primary bg-primary/10 shrink-0 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums sm:px-2.5 sm:text-xs">
                  {papersProcessed}/{totalPapers}
                </div>
              )}

              {/* Active spinner */}
              {isActive && (
                <div
                  className={`shrink-0 ${showPaperCount ? "hidden sm:block" : ""}`}
                >
                  <div className="border-primary/30 border-t-primary h-5 w-5 animate-spin rounded-full border-2" />
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
            className="bg-primary relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out"
            style={{ width: `${getProgressPercent(progress)}%` }}
          >
            <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </div>
        </div>
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{getProgressPercent(progress)}%</span>
          <span>{timeStr} elapsed</span>
        </div>
      </div>

      {/* Fun fact card */}
      <div className="border-border/50 bg-muted/30 rounded-xl border px-4 py-3">
        <div className="flex items-start gap-3">
          <BookOpen className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Did you know?
            </p>
            <p
              className={`text-foreground/80 text-sm transition-opacity duration-400 ${
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
    case "queued":
      return 2;
    case "after_started":
      return 5;
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
