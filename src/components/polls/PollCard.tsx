"use client";

import { useState } from "react";
import type { Poll } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PollCardProps {
  poll: Poll;
  index: number;
}

export function PollCard({ poll, index }: PollCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      className="animate-card-enter rounded-lg border border-border bg-card p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <h3 className="mb-4 text-sm font-semibold">{poll.question}</h3>
      <div className="space-y-2">
        {poll.options?.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            className={cn(
              "w-full rounded-md border px-4 py-2.5 text-left text-sm transition-all",
              selected === option
                ? "border-primary bg-primary/5 font-medium text-primary"
                : "border-border hover:border-primary/40 hover:bg-accent"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
