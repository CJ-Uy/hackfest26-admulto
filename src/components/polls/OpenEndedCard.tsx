import type { Poll } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";

interface OpenEndedCardProps {
  poll: Poll;
  index: number;
}

export function OpenEndedCard({ poll, index }: OpenEndedCardProps) {
  return (
    <div
      className="animate-card-enter rounded-lg border border-border bg-card p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <h3 className="mb-3 text-sm font-semibold">{poll.question}</h3>
      <Textarea
        placeholder="Type your answer here..."
        className="resize-none"
        rows={3}
      />
    </div>
  );
}
