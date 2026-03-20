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
  onBookmark: (paperId: string, bookmarked: boolean) => void;
  onComment: (paperId: string) => void;
}

export function PaperCard({ paper, scrollId, index, onUpvote, onBookmark, onComment }: PaperCardProps) {
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
      className="animate-card-enter cursor-pointer border-b border-border px-4 py-3 transition-colors hover:bg-[#fafafa]"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={navigateToDetail}
    >
      {/* Author row */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-foreground truncate">{authorDisplay}</span>
          {paper.peerReviewed && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-blue-500 text-white" />
          )}
          <span className="text-[12px] text-muted-foreground truncate">
            {paper.journal} &middot; {paper.year}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-heading text-[14px] font-bold leading-snug text-foreground mb-1">
        {paper.title}
      </h3>

      {/* Synthesis */}
      <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
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
        onBookmark={onBookmark}
      />
    </article>
  );
}
