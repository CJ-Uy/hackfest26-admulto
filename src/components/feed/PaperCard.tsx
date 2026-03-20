"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import type { Paper } from "@/lib/types";
import { CardActions } from "./CardActions";

interface PaperCardProps {
  paper: Paper;
  scrollId: string;
  index: number;
  commentCount: number;
  onUpvote: (paperId: string, voted: boolean) => void;
  onBookmark: (paperId: string, bookmarked: boolean) => void;
  onComment: (paperId: string) => void;
}

export function PaperCard({
  paper,
  scrollId,
  index,
  commentCount,
  onUpvote,
  onBookmark,
  onComment,
}: PaperCardProps) {
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
      className="animate-card-enter border-border cursor-pointer border-b px-4 py-3 transition-colors hover:bg-[#fafafa]"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={navigateToDetail}
    >
      {/* Author row */}
      <div className="mb-2 flex items-center gap-2.5">
        <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold">
          {initial}
        </div>
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-foreground truncate text-[15px] font-semibold">
            {authorDisplay}
          </span>
          {paper.peerReviewed && (
            <BadgeCheck className="h-4 w-4 shrink-0 fill-blue-500 text-white" />
          )}
          <span className="text-muted-foreground truncate text-[14px]">
            {paper.journal} &middot; {paper.year}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-heading text-foreground mb-1 text-[17px] leading-snug font-bold">
        {paper.title}
      </h3>

      {/* Synthesis */}
      <p className="text-muted-foreground line-clamp-3 text-[15px] leading-relaxed">
        {paper.synthesis}
      </p>

      {/* Actions */}
      <CardActions
        paperId={paper.id}
        credibilityScore={paper.credibilityScore}
        commentCount={commentCount}
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
