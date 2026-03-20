"use client";

import { useState } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Share2, BookmarkPlus } from "lucide-react";
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
}: CardActionsProps) {
  const [upvoted, setUpvoted] = useState(initialVoted);
  const [score, setScore] = useState(credibilityScore);

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
      // Revert on error
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
    toast.success("Paper bookmarked!");
  }

  const formattedCitations =
    citationCount >= 1000
      ? `${(citationCount / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : String(citationCount);

  return (
    <div className="flex items-center justify-between pt-3">
      <div className="flex items-center gap-1">
        {/* Upvote/downvote */}
        <div className="flex items-center">
          <button
            onClick={handleUpvote}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors",
              upvoted
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <ArrowBigUp
              className={cn("h-5 w-5", upvoted && "fill-primary")}
            />
          </button>
          <span className={cn("text-xs font-medium", upvoted ? "text-primary" : "text-muted-foreground")}>
            {score}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="flex items-center rounded-full px-1 py-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        {/* Comments */}
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          {commentCount}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
          {formattedCitations}
        </button>
      </div>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <BookmarkPlus className="h-4 w-4" />
      </button>
    </div>
  );
}
