import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CitationComment as CitationCommentType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CitationCommentProps {
  comment: CitationCommentType;
}

const relationshipConfig = {
  supports: { label: "Supports", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  challenges: { label: "Challenges", className: "bg-red-100 text-red-700 border-red-200" },
  extends: { label: "Extends", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

export function CitationComment({ comment }: CitationCommentProps) {
  const rel = relationshipConfig[comment.relationship];
  const initial = comment.authorName.charAt(0).toUpperCase();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {initial}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{comment.authorName}</span>
          {comment.peerReviewed && (
            <BadgeCheck className="h-3.5 w-3.5 fill-blue-500 text-white" />
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("ml-auto text-xs", rel.className)}
        >
          {rel.label}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed text-foreground">
        {comment.synthesis}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {comment.journal}, {comment.year}
      </p>
    </div>
  );
}
