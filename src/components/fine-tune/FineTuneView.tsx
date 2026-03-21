"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, Search, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FineTuneCard } from "./FineTuneCard";
import { toast } from "sonner";

interface FineTuneQuestion {
  id: string;
  question: string;
  options: string[];
  type: string;
}

interface FineTuneViewProps {
  scrollId: string;
  onRegenerated?: () => void;
}

const REGEN_STEPS = [
  {
    key: "searching",
    label: "Finding tailored papers",
    detail: "Searching based on your preferences",
    icon: Search,
  },
  {
    key: "processing",
    label: "Analyzing papers",
    detail: "Generating AI syntheses",
    icon: FileText,
  },
  {
    key: "exporting",
    label: "Building discussion",
    detail: "Generating researcher reactions",
    icon: Sparkles,
  },
];

function getStepIndex(step: string | undefined): number {
  if (!step) return 0;
  const idx = REGEN_STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

function getProgressPercent(progress: { step: string; papersProcessed?: number; total?: number } | null): number {
  if (!progress) return 5;
  switch (progress.step) {
    case "searching": return 15;
    case "processing": {
      const base = 20;
      const range = 55;
      if (progress.total && progress.total > 0) {
        return Math.round(base + (range * (progress.papersProcessed ?? 0)) / progress.total);
      }
      return base;
    }
    case "exporting": return 85;
    default: return 5;
  }
}

export function FineTuneView({ scrollId, onRegenerated }: FineTuneViewProps) {
  const [questions, setQuestions] = useState<FineTuneQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{
    step: string;
    papersProcessed?: number;
    total?: number;
  } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load or generate questions
  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      try {
        // Try to get existing questions
        const res = await fetch(
          `/api/fine-tune/questions?scrollId=${scrollId}`,
        );
        if (res.ok) {
          const data = (await res.json()) as FineTuneQuestion[];
          if (data.length > 0) {
            setQuestions(data);
            // Load saved answers
            for (const q of data) {
              try {
                const pollRes = await fetch(
                  `/api/poll-responses?pollId=${q.id}`,
                );
                if (pollRes.ok) {
                  const pollData = (await pollRes.json()) as {
                    answer?: string;
                  } | null;
                  if (pollData?.answer) {
                    setAnswers((prev) => new Map(prev).set(q.id, pollData.answer!));
                  }
                }
              } catch {
                // ignore
              }
            }
            setLoading(false);
            return;
          }
        }

        // Generate new questions
        setGenerating(true);
        const genRes = await fetch("/api/fine-tune/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scrollId }),
        });
        if (genRes.ok) {
          const data = (await genRes.json()) as FineTuneQuestion[];
          setQuestions(data);
        }
      } catch {
        toast.error("Failed to load fine-tune questions");
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    }

    loadQuestions();
  }, [scrollId]);

  // Elapsed timer during regeneration
  useEffect(() => {
    if (!regenerating) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [regenerating]);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      setAnswers((prev) => new Map(prev).set(questionId, answer));

      // Save to DB via poll-responses API
      try {
        await fetch("/api/poll-responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pollId: questionId, answer }),
        });
      } catch {
        // ignore
      }
    },
    [],
  );

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenProgress({ step: "searching" });
    setElapsed(0);

    try {
      await fetch("/api/fine-tune/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollId }),
      });

      // Poll for progress
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scrolls/${scrollId}/status`);
          if (!res.ok) return;
          const data = (await res.json()) as {
            status: string;
            progress?: string | null;
          };

          if (data.progress) {
            try {
              const prog =
                typeof data.progress === "string"
                  ? JSON.parse(data.progress)
                  : data.progress;
              setRegenProgress(prog);
            } catch {
              // ignore
            }
          }

          if (data.status === "complete") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setRegenerating(false);
            setRegenProgress(null);
            toast.success("Feed regenerated!");
            onRegenerated?.();
          }
        } catch {
          // ignore
        }
      }, 2500);
    } catch {
      setRegenerating(false);
      setRegenProgress(null);
      toast.error("Failed to regenerate feed");
    }
  }

  const answeredCount = answers.size;
  const totalQuestions = questions.length;
  const allAnswered = answeredCount >= totalQuestions && totalQuestions > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <Loader2 className="text-primary mb-3 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground text-[14px]">
          {generating
            ? "Generating personalized questions..."
            : "Loading..."}
        </p>
      </div>
    );
  }

  if (regenerating) {
    const currentStepIdx = getStepIndex(regenProgress?.step);
    const percent = getProgressPercent(regenProgress);
    const showPaperCount = regenProgress?.step === "processing" && (regenProgress.total ?? 0) > 0;

    return (
      <div className="px-4 py-6 animate-in fade-in duration-500">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
              <div className="relative h-2 w-2">
                <div className="bg-primary absolute inset-0 animate-ping rounded-full" />
                <div className="bg-primary relative h-2 w-2 rounded-full" />
              </div>
              Regenerating your feed
            </div>
            <p className="text-muted-foreground text-[13px]">
              Curating papers based on your preferences
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {REGEN_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIdx;
              const isDone = idx < currentStepIdx;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                    isActive
                      ? "border-primary/30 bg-primary/5 shadow-sm"
                      : isDone
                        ? "border-border/50 bg-muted/30"
                        : "border-transparent opacity-40"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
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
                  <div className="flex-1">
                    <p className="text-[13px] font-medium">
                      {step.label}
                      {isDone && (
                        <span className="text-primary ml-1.5 text-[11px]">
                          Done
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {step.detail}
                    </p>
                  </div>
                  {isActive && showPaperCount && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
                      {regenProgress!.papersProcessed}/{regenProgress!.total}
                    </span>
                  )}
                  {isActive && (
                    <div className="border-primary/30 border-t-primary h-4 w-4 animate-spin rounded-full border-2" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
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
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No fine-tune questions could be generated. Try interacting with your
          feed first.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="mb-5 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="text-foreground text-[16px] font-bold">
          Fine Tune Your Feed
        </h3>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-[13px]">
          Answer these questions to help us curate your research feed. Your
          upvoted, saved, and commented posts will be preserved.
        </p>
        <div className="text-muted-foreground mt-2 text-[12px]">
          {answeredCount} of {totalQuestions} answered
        </div>
      </div>

      {/* Questions */}
      <div className="mx-auto max-w-lg space-y-4">
        {questions.map((q, i) => (
          <FineTuneCard
            key={q.id}
            question={q}
            index={i}
            onAnswer={handleAnswer}
            savedAnswer={answers.get(q.id)}
          />
        ))}
      </div>

      {/* Regenerate button */}
      <div className="mt-6 text-center">
        <Button
          onClick={handleRegenerate}
          disabled={!allAnswered}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate My Feed
        </Button>
        {!allAnswered && (
          <p className="text-muted-foreground mt-2 text-[12px]">
            Answer all questions to regenerate
          </p>
        )}
      </div>
    </div>
  );
}
