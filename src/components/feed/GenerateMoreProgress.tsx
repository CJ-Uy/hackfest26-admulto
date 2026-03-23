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
}

interface GenerateMoreProgressProps {
  progress: ProgressInfo | null;
}

const STEPS = [
  {
    key: "searching",
    label: "Finding new papers",
    detail: "Searching based on your interests & interactions",
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
    label: "Building discussion",
    detail: "Generating researcher reactions",
    icon: Sparkles,
  },
];

const FUN_FACTS = [
  "Papers you upvote help us find more relevant research.",
  "Your poll answers shape which topics we explore next.",
  "Comments and bookmarks signal what matters to you.",
  "Each generation refines your feed further.",
  "Cross-referencing multiple databases for the best results.",
  "AI synthesis makes dense abstracts digestible.",
];

function getStepIndex(step: string | undefined): number {
  if (!step) return 0;
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

function getProgressPercent(progress: ProgressInfo | null): number {
  if (!progress) return 5;
  switch (progress.step) {
    case "searching":
      return 15;
    case "processing": {
      const base = 20;
      const range = 55;
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

export function GenerateMoreProgress({ progress }: GenerateMoreProgressProps) {
  const currentStepIdx = getStepIndex(progress?.step);
  const [factIndex, setFactIndex] = useState(() =>
    Math.floor(Math.random() * FUN_FACTS.length),
  );
  const [factVisible, setFactVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
        setFactVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const showPaperCount =
    progress?.step === "processing" && (progress.total ?? 0) > 0;
  const percent = getProgressPercent(progress);

  return (
    <div className="border-border animate-in fade-in mx-4 my-6 overflow-hidden rounded-xl border p-5 duration-500">
      {/* Header */}
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <div className="relative h-2 w-2">
          <div className="bg-primary absolute inset-0 animate-ping rounded-full" />
          <div className="bg-primary relative h-2 w-2 rounded-full" />
        </div>
        <span className="text-primary min-w-0 truncate text-[14px] font-semibold">
          Generating more papers
        </span>
        {showPaperCount && (
          <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums sm:text-[12px]">
            {progress!.papersProcessed}/{progress!.total}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="mb-4 space-y-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStepIdx;
          const isDone = idx < currentStepIdx;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-500 ${
                isActive
                  ? "bg-primary/5 border-primary/20 border"
                  : isDone
                    ? "opacity-60"
                    : "opacity-30"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? "animate-pulse" : ""}`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {step.label}
                  {isDone && (
                    <span className="text-primary ml-1.5 text-[11px]">
                      Done
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {step.detail}
                </p>
              </div>
              {isActive && (
                <div className="border-primary/30 border-t-primary h-4 w-4 animate-spin rounded-full border-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-3 space-y-1">
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          >
            <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </div>
        </div>
        <div className="text-muted-foreground flex justify-between text-[11px]">
          <span>{percent}%</span>
          <span>{elapsed}s</span>
        </div>
      </div>

      {/* Fun fact */}
      <div className="bg-subtle flex items-start gap-2 rounded-lg px-3 py-2">
        <BookOpen className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p
          className={`text-foreground/70 text-[12px] transition-opacity duration-400 ${
            factVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {FUN_FACTS[factIndex]}
        </p>
      </div>
    </div>
  );
}
