"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VerificationQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface PdfVerificationResult {
  title: string;
  authors: string[];
  questions: VerificationQuestion[];
}

interface PdfVerificationProps {
  pdfKeys: string[];
  pdfFilenames: string[];
  onComplete: (results: Map<string, boolean>) => void;
  onSkip: () => void;
}

export function PdfVerification({
  pdfKeys,
  pdfFilenames,
  onComplete,
  onSkip,
}: PdfVerificationProps) {
  const [currentPdfIndex, setCurrentPdfIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] =
    useState<PdfVerificationResult | null>(null);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const currentKey = pdfKeys[currentPdfIndex];
  const currentFilename = pdfFilenames[currentPdfIndex];

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      setLoading(true);
      setError(null);
      setVerification(null);
      setAnswers(new Map());
      setSubmitted(false);

      try {
        const res = await fetch("/api/pdf-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfKey: currentKey }),
        });

        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as PdfVerificationResult;
        if (!cancelled) setVerification(data);
      } catch {
        if (!cancelled) setError("Could not generate questions for this PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [currentKey]);

  function handleAnswer(questionIdx: number, optionIdx: number) {
    if (submitted) return;
    setAnswers((prev) => new Map(prev).set(questionIdx, optionIdx));
  }

  function handleSubmit() {
    if (!verification) return;
    setSubmitted(true);

    const allCorrect = verification.questions.every(
      (q, i) => answers.get(i) === q.correctIndex,
    );
    const allAnswered = verification.questions.every((_, i) => answers.has(i));

    setResults((prev) =>
      new Map(prev).set(currentKey, allAnswered && allCorrect),
    );
  }

  function handleNext() {
    if (currentPdfIndex < pdfKeys.length - 1) {
      setCurrentPdfIndex((i) => i + 1);
    } else {
      onComplete(results);
    }
  }

  const totalQuestions = verification?.questions.length ?? 0;
  const answeredCount = answers.size;
  const isLastPdf = currentPdfIndex === pdfKeys.length - 1;

  if (loading) {
    return (
      <div className="space-y-4 py-8 text-center">
        <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
        <div>
          <p className="text-foreground text-sm font-medium">
            Analyzing &ldquo;{currentFilename}&rdquo;...
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Generating verification questions about the paper&apos;s content
          </p>
        </div>
      </div>
    );
  }

  if (error || !verification || verification.questions.length === 0) {
    return (
      <div className="space-y-4 py-6">
        <div className="text-center">
          <FileText className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            {error || "No verification questions could be generated."}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNext}>
            {isLastPdf ? "Continue" : "Next PDF"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip verification
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-border rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <FileText className="text-primary h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {verification.title}
            </p>
            {verification.authors.length > 0 && (
              <p className="text-muted-foreground truncate text-xs">
                {verification.authors.join(", ")}
              </p>
            )}
          </div>
          <span className="text-muted-foreground shrink-0 text-xs">
            PDF {currentPdfIndex + 1}/{pdfKeys.length}
          </span>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Answer these questions to verify the system correctly understood your
        paper. This helps ensure accurate feed generation.
      </p>

      {/* Questions */}
      <div className="space-y-4">
        {verification.questions.map((q, qIdx) => {
          const selectedOption = answers.get(qIdx);
          const isCorrect = submitted && selectedOption === q.correctIndex;
          const isWrong =
            submitted &&
            selectedOption !== undefined &&
            selectedOption !== q.correctIndex;

          return (
            <div key={qIdx} className="space-y-2">
              <p className="text-foreground text-sm font-medium">
                {qIdx + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, oIdx) => {
                  const isSelected = selectedOption === oIdx;
                  const isCorrectAnswer = submitted && oIdx === q.correctIndex;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswer(qIdx, oIdx)}
                      disabled={submitted}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        !submitted && isSelected
                          ? "border-primary bg-primary/5"
                          : !submitted
                            ? "border-border hover:border-primary/40"
                            : isCorrectAnswer
                              ? "border-green-500 bg-green-50"
                              : isSelected && isWrong
                                ? "border-red-400 bg-red-50"
                                : "border-border opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border text-muted-foreground",
                          submitted &&
                            isCorrectAnswer &&
                            "border-green-500 bg-green-500 text-white",
                          submitted &&
                            isSelected &&
                            isWrong &&
                            "border-red-400 bg-red-400 text-white",
                        )}
                      >
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {submitted && isCorrectAnswer && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      )}
                      {submitted && isSelected && isWrong && (
                        <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip verification
        </Button>

        {!submitted ? (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={answeredCount < totalQuestions}
          >
            Check Answers ({answeredCount}/{totalQuestions})
          </Button>
        ) : (
          <Button size="sm" onClick={handleNext} className="gap-1">
            {isLastPdf ? "Continue to Generate" : "Next PDF"}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
