"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import type { Paper } from "@/lib/types";
import { CardActions } from "./CardActions";

interface PaperCardProps {
  paper: Paper;
  scrollId: string;
  index: number;
  onUpvote: (paperId: string, voted: boolean) => void;
  onComment: (paperId: string) => void;
}

export function PaperCard({ paper, scrollId, index, onUpvote, onComment }: PaperCardProps) {
  const router = useRouter();

  const primaryAuthor = paper.authors[0] ?? "Unknown";
  const authorDisplay =
    paper.authors.length > 1
      ? `${paper.authors[0]} & ${paper.authors[1]}`
      : paper.authors[0] || "Unknown";
  const initial = primaryAuthor.charAt(0).toUpperCase();

  function navigateToDetail() {
    router.push(`/scroll/${scrollId}/post/${paper.id}`);
  }

  return (
    <article
      className="animate-card-enter cursor-pointer border-b border-border px-4 py-4 transition-colors hover:bg-accent/30"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={navigateToDetail}
    >
      {/* Author row */}
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{authorDisplay}</span>
            {paper.peerReviewed && (
              <BadgeCheck className="h-4 w-4 shrink-0 fill-blue-500 text-white" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {paper.journal} &middot; {paper.year}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-heading mb-1.5 text-[15px] font-bold leading-snug tracking-tight">
        {paper.title}
      </h3>

      {/* Synthesis */}
      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
        {paper.synthesis}
      </p>

      {/* Actions */}
      <CardActions
        paperId={paper.id}
        credibilityScore={paper.credibilityScore}
        commentCount={paper.commentCount}
        citationCount={paper.citationCount}
        apaCitation={paper.apaCitation}
        initialVoted={paper.voted}
        onCommentClick={navigateToDetail}
        onUpvote={onUpvote}
      />
    </article>
  );
}
