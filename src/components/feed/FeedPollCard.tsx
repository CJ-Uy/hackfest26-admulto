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
  const [selected, setSelected] = useState<string | null>(
    poll.selectedAnswer ?? null,
  );
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
      toast.error("Failed to submit.");
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
    } catch {
      toast.error("Failed to submit.");
      setSubmitted(false);
    }
  }

  return (
    <div className="border-border overflow-hidden border-b px-4 py-3">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <BarChart3 className="text-primary h-4 w-4" />
        </div>
        <span className="text-foreground text-[15px] font-semibold">Poll</span>
        <span className="text-muted-foreground text-[14px]">
          &middot; Help refine your feed
        </span>
      </div>

      <p className="text-foreground mb-2 text-[15px] font-semibold">
        {poll.question}
      </p>

      {poll.type === "multiple-choice" && poll.options ? (
        <div className="space-y-1.5">
          {poll.options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={submitted}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left text-[15px] transition-all",
                selected === option
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : submitted
                    ? "border-border text-muted-foreground cursor-default"
                    : "border-border hover:border-primary/40 hover:bg-subtle",
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
            className="border-border focus:border-primary w-full resize-none rounded-md border bg-transparent px-3 py-2 text-[15px] focus:outline-none"
            rows={2}
          />
          {!submitted && (
            <button
              onClick={handleOpenSubmit}
              disabled={!openAnswer.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-1.5 text-[14px] font-semibold disabled:opacity-40"
            >
              Submit
            </button>
          )}
        </div>
      )}

      {submitted && (
        <p className="text-muted-foreground mt-2 text-[14px]">
          Response recorded
        </p>
      )}
    </div>
  );
}
