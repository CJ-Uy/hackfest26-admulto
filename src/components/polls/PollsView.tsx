import { polls } from "@/lib/data/polls";
import { PollCard } from "./PollCard";
import { OpenEndedCard } from "./OpenEndedCard";

export function PollsView() {
  return (
    <div className="mx-auto max-w-[680px] px-4">
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
