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
        <p className="text-muted-foreground text-sm">
          No polls available for this scroll yet.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <p className="text-muted-foreground mb-4 text-center text-xs">
        Help the AI understand your interests. Your responses improve your feed
        recommendations.
      </p>
      <div className="space-y-4">
        {polls.map((poll, i) =>
          poll.type === "multiple-choice" ? (
            <PollCard key={poll.id} poll={poll} index={i} />
          ) : (
            <OpenEndedCard key={poll.id} poll={poll} index={i} />
          ),
        )}
      </div>
    </div>
  );
}
