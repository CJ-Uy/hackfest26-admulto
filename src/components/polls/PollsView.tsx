"use client";

import type { Poll } from "@/lib/types";
import { PollCard } from "./PollCard";
import { OpenEndedCard } from "./OpenEndedCard";

interface PollsViewProps {
  polls: Poll[];
}

export function PollsView({ polls }: PollsViewProps) {
  if (polls.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No polls available for this scroll yet.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-center text-xs text-muted-foreground">
        Help the AI understand your interests. Your responses improve your feed
        recommendations.
      </p>
      <div className="space-y-4">
        {polls.map((poll, i) =>
          poll.type === "multiple-choice" ? (
            <PollCard key={poll.id} poll={poll} index={i} />
          ) : (
            <OpenEndedCard key={poll.id} poll={poll} index={i} />
          )
        )}
      </div>
    </div>
  );
}
