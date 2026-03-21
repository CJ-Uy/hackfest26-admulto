"use client";

import { useState } from "react";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCredibilityTier } from "@/lib/credibility";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

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
  const tier = getCredibilityTier(credibilityScore);

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
    <div className="-mx-1 mt-2 flex items-center justify-between">
      <div className="flex items-center">
        {/* Vote cluster */}
        <div className="mr-1 flex items-center rounded-full bg-[#f6f7f8]">
          <button
            onClick={handleUpvote}
            className={cn(
              "rounded-l-full p-1.5 transition-colors",
              upvoted
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:bg-[#ffe9e0] hover:text-[#ff4500]",
            )}
          >
            <ArrowBigUp className={cn("h-5 w-5", upvoted && "fill-current")} />
          </button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className={cn(
                  "min-w-6 cursor-help text-center text-[14px] font-bold",
                  upvoted ? "text-[#ff4500]" : "text-foreground",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {fmt(score)}
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-55 border bg-white text-left text-foreground shadow-md"
              >
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-sm font-semibold", tier.color)}>
                    {tier.label}
                  </span>
                  <span className="text-xs opacity-80">
                    {tier.description}
                  </span>
                  <span className="mt-0.5 text-[10px] opacity-60">
                    Based on citations, venue, and recency
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-muted-foreground hover:text-primary rounded-r-full p-1.5 transition-colors hover:bg-[#dae8f5]"
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        {/* Credibility badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className={cn(
                "mr-1 cursor-help rounded-full px-2 py-0.5 text-xs font-semibold",
                tier.bg,
                tier.textOnBg,
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {tier.label}
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-55 border bg-white text-left text-foreground shadow-md"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs opacity-80">{tier.description}</span>
                <span className="mt-0.5 text-[10px] opacity-60">
                  Based on citations, venue, and recency
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Comment */}
        <button
          onClick={handleCommentClick}
          className="text-muted-foreground mr-1 flex items-center gap-1.5 rounded-full bg-[#f6f7f8] px-3.5 py-1.5 text-[14px] font-bold transition-colors hover:bg-[#e8e8e8]"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          {commentCount}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="text-muted-foreground mr-1 flex items-center gap-1.5 rounded-full bg-[#f6f7f8] px-3.5 py-1.5 text-[14px] font-bold transition-colors hover:bg-[#e8e8e8]"
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
            : "text-muted-foreground hover:bg-[#f6f7f8]",
        )}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      </button>
    </div>
  );
}
