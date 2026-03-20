"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Poll } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PollCardProps {
  poll: Poll;
  index: number;
}

export function PollCard({ poll, index }: PollCardProps) {
  const [selected, setSelected] = useState<string | null>(
    poll.selectedAnswer ?? null,
  );
  const [submitted, setSubmitted] = useState(!!poll.selectedAnswer);

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

  return (
    <div
      className="animate-card-enter border-border bg-card rounded-lg border p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <h3 className="mb-4 text-sm font-semibold">{poll.question}</h3>
      <div className="space-y-2">
        {poll.options?.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            disabled={submitted}
            className={cn(
              "w-full rounded-md border px-4 py-2.5 text-left text-sm transition-all",
              selected === option
                ? "border-primary bg-primary/5 text-primary font-medium"
                : submitted
                  ? "border-border text-muted-foreground cursor-default"
                  : "border-border hover:border-primary/40 hover:bg-accent",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {submitted && (
        <p className="text-muted-foreground mt-3 text-xs">Response recorded!</p>
      )}
    </div>
  );
}
