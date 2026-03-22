"use client";

import { useState } from "react";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  Sparkles,
  Trash2,
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
  initialDownvoted?: boolean;
  initialBookmarked?: boolean;
  onCommentClick?: () => void;
  onUpvote?: (paperId: string, voted: boolean) => void;
  onDownvote?: (paperId: string, downvoted: boolean) => void;
  onBookmark?: (paperId: string, bookmarked: boolean) => void;
  onGenerateComments?: (paperId: string) => void;
  onDelete?: (paperId: string) => void;
  hasNewComments?: boolean;
}

export function CardActions({
  paperId,
  credibilityScore,
  commentCount,
  citationCount,
  apaCitation,
  initialVoted = false,
  initialDownvoted = false,
  initialBookmarked = false,
  onCommentClick,
  onUpvote,
  onDownvote,
  onBookmark,
  onGenerateComments,
  onDelete,
  hasNewComments,
}: CardActionsProps) {
  const [upvoted, setUpvoted] = useState(initialVoted);
  const [downvoted, setDownvoted] = useState(initialDownvoted);
  const [generatingComments, setGeneratingComments] = useState(false);
  const [score, setScore] = useState(credibilityScore);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const tier = getCredibilityTier(credibilityScore);

  async function handleUpvote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const newVoted = !upvoted;
    const wasDownvoted = downvoted;
    setUpvoted(newVoted);
    if (newVoted) setDownvoted(false);
    setScore(newVoted ? credibilityScore + 1 : credibilityScore);
    onUpvote?.(paperId, newVoted);
    if (newVoted && wasDownvoted) onDownvote?.(paperId, false);

    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, value: 1 }),
      });
    } catch {
      setUpvoted(!newVoted);
      if (wasDownvoted) setDownvoted(true);
      setScore(credibilityScore);
      toast.error("Vote failed. Please try again.");
    }
  }

  async function handleDownvote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const newDownvoted = !downvoted;
    const wasUpvoted = upvoted;
    setDownvoted(newDownvoted);
    if (newDownvoted) setUpvoted(false);
    setScore(newDownvoted ? credibilityScore - 1 : credibilityScore);
    onDownvote?.(paperId, newDownvoted);
    if (newDownvoted && wasUpvoted) onUpvote?.(paperId, false);

    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, value: -1 }),
      });
    } catch {
      setDownvoted(!newDownvoted);
      if (wasUpvoted) setUpvoted(true);
      setScore(credibilityScore);
      toast.error("Vote failed. Please try again.");
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

  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    onBookmark?.(paperId, next);
    toast.success(next ? "Saved" : "Removed from saved");

    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
    } catch {
      setBookmarked(!next);
      toast.error("Bookmark failed. Please try again.");
    }
  }

  async function handleGenerateComments(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (generatingComments || !onGenerateComments) return;
    setGeneratingComments(true);
    try {
      await onGenerateComments(paperId);
      toast.success("Generating new comments...");
    } catch {
      toast.error("Failed to generate comments");
    } finally {
      setGeneratingComments(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete) return;
    onDelete(paperId);
  }

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-y-1">
      <div className="flex flex-wrap items-center gap-y-1">
        {/* Vote cluster */}
        <div className="mr-1 flex items-center rounded-full bg-subtle">
          <button
            onClick={handleUpvote}
            aria-label={upvoted ? "Remove upvote" : "Upvote"}
            className={cn(
              "rounded-l-full p-2.5 transition-colors",
              upvoted
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-[#ff4500]",
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
                className="text-foreground max-w-55 border bg-tooltip-bg text-left shadow-md"
              >
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-sm font-semibold", tier.color)}>
                    {tier.label}
                  </span>
                  <span className="text-xs opacity-80">{tier.description}</span>
                  <span className="mt-0.5 text-[10px] opacity-60">
                    Based on citations, venue, and recency
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={handleDownvote}
            aria-label={downvoted ? "Remove downvote" : "Downvote"}
            className={cn(
              "rounded-r-full p-2.5 transition-colors",
              downvoted
                ? "text-[#7193ff]"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            <ArrowBigDown
              className={cn("h-5 w-5", downvoted && "fill-current")}
            />
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
              className="text-foreground max-w-55 border bg-tooltip-bg text-left shadow-md"
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
          aria-label={`${commentCount} comments`}
          className="text-muted-foreground relative mr-1 flex items-center gap-1.5 rounded-full bg-subtle px-3.5 py-1.5 text-[14px] font-bold transition-colors hover:bg-subtle-hover"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          {commentCount}
          {hasNewComments && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="text-muted-foreground mr-1 flex items-center gap-1.5 rounded-full bg-subtle px-3.5 py-1.5 text-[14px] font-bold transition-colors hover:bg-subtle-hover"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Generate Comments */}
        {onGenerateComments && (
          <button
            onClick={handleGenerateComments}
            disabled={generatingComments}
            aria-label="Generate AI comments"
            className={cn(
              "text-muted-foreground flex items-center gap-1.5 rounded-full bg-subtle px-3.5 py-1.5 text-[14px] font-bold transition-colors hover:bg-subtle-hover",
              generatingComments && "opacity-50",
            )}
          >
            <Sparkles
              className={cn("h-4 w-4", generatingComments && "animate-spin")}
            />
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {/* Bookmark */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<button />}
              onClick={handleBookmark}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                bookmarked
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:bg-subtle",
              )}
            >
              <Bookmark
                className={cn("h-4 w-4", bookmarked && "fill-current")}
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="text-foreground border bg-tooltip-bg text-left shadow-md"
            >
              <span className="text-xs">
                {bookmarked
                  ? "Remove from saved papers"
                  : "Save this paper for later"}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete */}
        {onDelete && (
          <button
            onClick={handleDelete}
            aria-label="Delete paper"
            className="text-muted-foreground rounded-full p-2.5 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
