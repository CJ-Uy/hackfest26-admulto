"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FineTuneCardProps {
  question: {
    id: string;
    question: string;
    options: string[];
  };
  index: number;
  onAnswer: (questionId: string, answer: string) => void;
  savedAnswer?: string;
}

export function FineTuneCard({
  question,
  index,
  onAnswer,
  savedAnswer,
}: FineTuneCardProps) {
  const [selected, setSelected] = useState<string | null>(savedAnswer || null);
  const [otherText, setOtherText] = useState(
    savedAnswer && !question.options.includes(savedAnswer) ? savedAnswer : "",
  );
  const [submitted, setSubmitted] = useState(!!savedAnswer);

  function handleSelect(option: string) {
    if (submitted) return;
    if (option === "Other") {
      setSelected("Other");
    } else {
      setSelected(option);
      setOtherText("");
    }
  }

  function handleSubmit() {
    const answer = selected === "Other" ? otherText.trim() : selected;
    if (!answer) return;
    setSubmitted(true);
    onAnswer(question.id, answer);
  }

  return (
    <div
      className={cn(
        "border-border rounded-xl border p-5 transition-all duration-300",
        submitted ? "bg-muted/30 opacity-80" : "bg-background",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold">
          {index + 1}
        </span>
        {submitted && (
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
            Answered
          </span>
        )}
      </div>

      <h4 className="text-foreground mb-3 text-[15px] font-semibold">
        {question.question}
      </h4>

      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selected === option;
          const isOther = option === "Other";

          return (
            <div key={option}>
              <button
                onClick={() => handleSelect(option)}
                disabled={submitted}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-[14px] transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground font-medium"
                    : "border-border hover:border-primary/30 hover:bg-primary/5 text-foreground",
                  submitted && "cursor-default opacity-70",
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span>{option}</span>
              </button>

              {/* Other text input */}
              {isOther && isSelected && !submitted && (
                <input
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Type your answer..."
                  className="border-border text-foreground placeholder:text-muted-foreground mt-2 ml-8 w-[calc(100%-2rem)] rounded-lg border bg-transparent px-3 py-2 text-[14px] outline-none focus:border-primary"
                  autoFocus
                />
              )}
            </div>
          );
        })}
      </div>

      {!submitted && selected && (
        <button
          onClick={handleSubmit}
          disabled={selected === "Other" && !otherText.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40"
        >
          Confirm
        </button>
      )}
    </div>
  );
}
