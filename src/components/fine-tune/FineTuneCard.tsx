"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FineTuneCardProps {
  question: {
    id: string;
    question: string;
    options: string[];
  };
  onAnswer: (questionId: string, answer: string) => void;
  savedAnswer?: string;
}

export function FineTuneCard({
  question,
  onAnswer,
  savedAnswer,
}: FineTuneCardProps) {
  const [selected, setSelected] = useState<string | null>(savedAnswer || null);
  const [otherText, setOtherText] = useState(
    savedAnswer && !question.options.includes(savedAnswer) ? savedAnswer : "",
  );

  function handleSelect(option: string) {
    setSelected(option);
    if (option !== "Other") {
      onAnswer(question.id, option);
    } else {
      setOtherText("");
    }
  }

  function handleOtherSubmit() {
    const trimmed = otherText.trim();
    if (!trimmed) return;
    onAnswer(question.id, trimmed);
  }

  return (
    <div>
      <p className="text-foreground mb-4 text-[15px] leading-snug font-semibold">
        {question.question}
      </p>

      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selected === option;
          const isOther = option === "Other";

          return (
            <div key={option}>
              <button
                onClick={() => handleSelect(option)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14px] transition-all duration-150",
                  isSelected
                    ? "border-primary/60 bg-primary/8 text-foreground font-medium shadow-sm"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/40 text-foreground/80",
                )}
              >
                <div
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30 group-hover:border-primary/50",
                  )}
                >
                  {isSelected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span>{option}</span>
              </button>

              {isOther && isSelected && (
                <div className="mt-2 ml-9 flex gap-2">
                  <input
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOtherSubmit()}
                    placeholder="Type your answer..."
                    className="border-border text-foreground placeholder:text-muted-foreground focus:border-primary flex-1 rounded-lg border bg-transparent px-3 py-2 text-[13px] transition-colors outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleOtherSubmit}
                    disabled={!otherText.trim()}
                    className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-[13px] font-medium disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
