"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Poll } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeedPollCardProps {
  poll: Poll;
}

export function FeedPollCard({ poll }: FeedPollCardProps) {
  const [selected, setSelected] = useState<string | null>(poll.selectedAnswer ?? null);
  const [submitted, setSubmitted] = useState(!!poll.selectedAnswer);
  const [openAnswer, setOpenAnswer] = useState(poll.selectedAnswer ?? "");

  async function handleSelect(option: string) {
    if (submitted) return;
    setSelected(option);
    setSubmitted(true);

    try {
      await fetch("/api/poll-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, answer: option }),
      });
    } catch {
      toast.error("Failed to submit response.");
      setSubmitted(false);
      setSelected(null);
    }
  }

  async function handleOpenSubmit() {
    if (!openAnswer.trim() || submitted) return;
    setSubmitted(true);

    try {
      await fetch("/api/poll-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, answer: openAnswer.trim() }),
      });
      toast.success("Response submitted!");
    } catch {
      toast.error("Failed to submit response.");
      setSubmitted(false);
    }
  }

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
          <BarChart3 className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <span className="text-sm font-semibold">Poll</span>
          <span className="text-xs text-muted-foreground ml-2">Help refine your feed</span>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold">{poll.question}</h3>

      {poll.type === "multiple-choice" && poll.options ? (
        <div className="space-y-2">
          {poll.options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={submitted}
              className={cn(
                "w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all",
                selected === option
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : submitted
                    ? "border-border text-muted-foreground cursor-default"
                    : "border-border hover:border-primary/40 hover:bg-accent"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={openAnswer}
            onChange={(e) => setOpenAnswer(e.target.value)}
            placeholder="Type your answer..."
            disabled={submitted}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm resize-none focus:border-primary focus:outline-none"
            rows={2}
          />
          {!submitted && (
            <button
              onClick={handleOpenSubmit}
              disabled={!openAnswer.trim()}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Submit
            </button>
          )}
        </div>
      )}

      {submitted && (
        <p className="mt-2 text-xs text-muted-foreground">Response recorded. Thank you!</p>
      )}
    </div>
  );
}
