"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FineTuneCard } from "@/components/fine-tune/FineTuneCard";
import { toast } from "sonner";

interface ExportPromptQuestion {
  id: string;
  question: string;
  options: string[];
  type: string;
}

interface ExportPromptQuizProps {
  scrollId: string;
  onComplete: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function ExportPromptQuiz({
  scrollId,
  onComplete,
  onSkip,
}: ExportPromptQuizProps) {
  const [questions, setQuestions] = useState<ExportPromptQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load or generate questions
  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      try {
        // Try to get existing questions
        const res = await fetch(
          `/api/export-prompt/questions?scrollId=${scrollId}`,
        );
        if (res.ok) {
          const data = (await res.json()) as ExportPromptQuestion[];
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
                    setAnswers((prev) =>
                      new Map(prev).set(q.id, pollData.answer!),
                    );
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
        const genRes = await fetch("/api/export-prompt/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scrollId }),
        });
        if (genRes.ok) {
          const data = (await genRes.json()) as ExportPromptQuestion[];
          setQuestions(data);
        }
      } catch {
        toast.error("Failed to load scoping questions");
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    }

    loadQuestions();
  }, [scrollId]);

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

  function handleComplete() {
    // Convert answers map to Record<questionText, answer>
    const result: Record<string, string> = {};
    for (const q of questions) {
      const answer = answers.get(q.id);
      if (answer) {
        result[q.question] = answer;
      }
    }
    onComplete(result);
  }

  const answeredCount = answers.size;
  const totalQuestions = questions.length;
  const allAnswered = answeredCount >= totalQuestions && totalQuestions > 0;
  const currentQuestion = questions[currentIndex];
  const canGoNext = currentQuestion ? answers.has(currentQuestion.id) : false;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <Loader2 className="text-primary mb-3 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground text-[14px]">
          {generating ? "Generating scoping questions..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No scoping questions could be generated.
        </p>
        <button
          onClick={onSkip}
          className="text-primary mt-2 text-sm hover:underline"
        >
          Generate prompt without scoping
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-5">
      {/* Header */}
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
            <MessageSquareText className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-foreground text-[15px] font-bold">
            Scope Your Research Prompt
          </h3>
        </div>
        <p className="text-muted-foreground text-[12px] leading-relaxed">
          Answer a few questions to generate a more targeted research prompt.
        </p>
      </div>

      {/* Progress bar + counter */}
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${((currentIndex + (answers.has(currentQuestion?.id ?? "") ? 1 : 0)) / totalQuestions) * 100}%`,
            }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* Current question */}
      {currentQuestion && (
        <>
          <div className="border-border/50 rounded-xl border p-4">
            <FineTuneCard
              key={currentQuestion.id}
              question={currentQuestion}
              onAnswer={handleAnswer}
              savedAnswer={answers.get(currentQuestion.id)}
            />
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="text-muted-foreground text-[13px]"
            >
              Previous
            </Button>

            {currentIndex < totalQuestions - 1 ? (
              <Button
                size="sm"
                variant={canGoNext ? "default" : "outline"}
                onClick={() =>
                  setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
                }
                disabled={!canGoNext}
                className="text-[13px]"
              >
                Next
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={!allAnswered}
                className="gap-1.5 text-[13px]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Prompt
              </Button>
            )}
          </div>

          {!allAnswered && currentIndex === totalQuestions - 1 && (
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              Answer all questions to generate your prompt
            </p>
          )}

          {/* Skip link */}
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground mt-4 text-center text-[11px] transition-colors"
          >
            Skip and generate basic prompt
          </button>
        </>
      )}
    </div>
  );
}
