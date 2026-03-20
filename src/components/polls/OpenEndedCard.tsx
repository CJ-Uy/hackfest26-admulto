"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { Poll } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface OpenEndedCardProps {
  poll: Poll;
  index: number;
}

export function OpenEndedCard({ poll, index }: OpenEndedCardProps) {
  const [answer, setAnswer] = useState(poll.selectedAnswer ?? "");
  const [submitted, setSubmitted] = useState(!!poll.selectedAnswer);

  async function handleSubmit() {
    if (!answer.trim() || submitted) return;
    setSubmitted(true);

    try {
      await fetch("/api/poll-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, answer: answer.trim() }),
      });
      toast.success("Response submitted!");
    } catch {
      toast.error("Failed to submit response.");
      setSubmitted(false);
    }
  }

  return (
    <div
      className="animate-card-enter rounded-lg border border-border bg-card p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <h3 className="mb-3 text-sm font-semibold">{poll.question}</h3>
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here..."
        className="resize-none"
        rows={3}
        disabled={submitted}
      />
      {!submitted && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={!answer.trim()}
          >
            <Send className="h-3.5 w-3.5" />
            Submit
          </Button>
        </div>
      )}
      {submitted && (
        <p className="mt-3 text-xs text-muted-foreground">Response recorded!</p>
      )}
    </div>
  );
}
