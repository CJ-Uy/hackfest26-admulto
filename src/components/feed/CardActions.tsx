"use client";

import { useState } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CardActionsProps {
  paperId: string;
  credibilityScore: number;
  commentCount: number;
  citationCount: number;
  apaCitation: string;
  initialVoted?: boolean;
  onCommentClick?: () => void;
  onUpvote?: (paperId: string, voted: boolean) => void;
  onBookmark?: (paperId: string, bookmarked: boolean) => void;
}

export function CardActions({
  paperId,
  credibilityScore,
  commentCount,
  citationCount,
  apaCitation,
  initialVoted = false,
  onCommentClick,
  onUpvote,
  onBookmark,
}: CardActionsProps) {
  const [upvoted, setUpvoted] = useState(initialVoted);
  const [score, setScore] = useState(credibilityScore);
  const [bookmarked, setBookmarked] = useState(false);

  async function handleUpvote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const newVoted = !upvoted;
    setUpvoted(newVoted);
    setScore(newVoted ? credibilityScore + 1 : credibilityScore);
    onUpvote?.(paperId, newVoted);

    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
    } catch {
      setUpvoted(!newVoted);
      setScore(credibilityScore);
    }
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(apaCitation);
    toast.success("APA citation copied!");
  }

  function handleCommentClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onCommentClick?.();
  }

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    onBookmark?.(paperId, next);
    toast.success(next ? "Saved" : "Removed from saved");
  }

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

  return (
    <div className="flex items-center justify-between mt-2 -mx-1">
      <div className="flex items-center">
        {/* Vote cluster */}
        <div className="flex items-center rounded-full bg-[#f6f7f8] mr-1">
          <button
            onClick={handleUpvote}
            className={cn(
              "rounded-l-full p-1.5 transition-colors",
              upvoted
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:text-[#ff4500] hover:bg-[#ffe9e0]"
            )}
          >
            <ArrowBigUp className={cn("h-5 w-5", upvoted && "fill-current")} />
          </button>
          <span className={cn("text-[14px] font-bold min-w-[24px] text-center", upvoted ? "text-[#ff4500]" : "text-foreground")}>
            {fmt(score)}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="rounded-r-full p-1.5 text-muted-foreground transition-colors hover:text-primary hover:bg-[#dae8f5]"
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        {/* Comment */}
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 rounded-full bg-[#f6f7f8] px-3.5 py-1.5 text-[14px] font-bold text-muted-foreground transition-colors hover:bg-[#e8e8e8] mr-1"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          {commentCount}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full bg-[#f6f7f8] px-3.5 py-1.5 text-[14px] font-bold text-muted-foreground transition-colors hover:bg-[#e8e8e8] mr-1"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className={cn(
          "rounded-full p-1.5 transition-colors",
          bookmarked
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:bg-[#f6f7f8]"
        )}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      </button>
    </div>
  );
}
