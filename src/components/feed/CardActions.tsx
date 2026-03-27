"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  Sparkles,
  Trash2,
  MoreHorizontal,
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; left: number }>(
    {
      top: 0,
      left: 0,
    },
  );
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const tier = getCredibilityTier(credibilityScore);

  function placeMoreMenu() {
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    const menuWidth = 176; // w-44
    const viewportPadding = 8;
    const preferredLeft = rect.right - menuWidth;
    const left = Math.max(
      viewportPadding,
      Math.min(preferredLeft, window.innerWidth - menuWidth - viewportPadding),
    );
    const top = rect.bottom + 6;
    setMoreMenuPos({ top, left });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!moreMenuRef.current) return;
      if (!moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }

    function handleReposition() {
      if (moreOpen) {
        placeMoreMenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [moreOpen]);

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
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, value: 1 }),
      });
      if (!res.ok) throw new Error("Vote API error");
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
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, value: -1 }),
      });
      if (!res.ok) throw new Error("Vote API error");
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
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      if (!res.ok) throw new Error("Bookmark API error");
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
    <div className="mt-2 flex items-center justify-between md:flex-wrap md:gap-y-1">
      <div className="flex min-w-0 flex-nowrap items-center gap-1 md:flex-wrap md:gap-y-1">
        {/* Vote cluster */}
        <div className="bg-subtle flex items-center rounded-full">
          <button
            onClick={handleUpvote}
            aria-label={upvoted ? "Remove upvote" : "Upvote"}
            className={cn(
              "rounded-l-full p-2 transition-colors md:p-2.5",
              upvoted
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-[#ff4500]",
            )}
          >
            <ArrowBigUp
              className={cn(
                "h-4.5 w-4.5 md:h-5 md:w-5",
                upvoted && "fill-current",
              )}
            />
          </button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className={cn(
                  "min-w-6 cursor-help px-0.5 text-center text-[13px] font-bold md:text-[14px]",
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
                className="text-foreground bg-tooltip-bg max-w-55 border text-left shadow-md"
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
              "rounded-r-full p-2 transition-colors md:p-2.5",
              downvoted
                ? "text-[#7193ff]"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            <ArrowBigDown
              className={cn(
                "h-4.5 w-4.5 md:h-5 md:w-5",
                downvoted && "fill-current",
              )}
            />
          </button>
        </div>

        {/* Credibility badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className={cn(
                "inline-flex h-8 cursor-help items-center justify-center rounded-full px-3 text-[13px] font-semibold md:h-9 md:text-[14px]",
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
              className="text-foreground bg-tooltip-bg max-w-55 border text-left shadow-md"
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
          className="text-muted-foreground bg-subtle hover:bg-subtle-hover relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors md:px-3.5 md:text-[14px]"
        >
          <MessageSquare className="h-4 w-4 md:h-4.5 md:w-4.5" />
          {commentCount}
          {hasNewComments && (
            <span className="ring-background absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2" />
          )}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="text-muted-foreground bg-subtle hover:bg-subtle-hover hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors md:flex"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Generate Comments */}
        {onGenerateComments && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<button />}
                onClick={handleGenerateComments}
                disabled={generatingComments}
                aria-label="Generate AI comments"
                className={cn(
                  "text-muted-foreground bg-subtle hover:bg-subtle-hover relative hidden items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors md:flex",
                )}
              >
                {generatingComments && (
                  <span className="bg-primary/20 absolute inset-x-0 bottom-0 h-0.75 overflow-hidden rounded-full">
                    <span className="bg-primary absolute inset-y-0 w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full" />
                  </span>
                )}
                <Sparkles
                  className={cn(
                    "h-4 w-4 transition-colors",
                    generatingComments && "text-primary animate-pulse",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="text-foreground bg-tooltip-bg border text-left shadow-md"
              >
                <span className="text-xs">This will generate comments</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Mobile overflow menu */}
        <div className="relative ml-auto md:hidden" ref={moreMenuRef}>
          <button
            ref={moreButtonRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMoreOpen((prev) => {
                const next = !prev;
                if (next) {
                  placeMoreMenu();
                }
                return next;
              });
            }}
            aria-label="More actions"
            className="text-muted-foreground bg-subtle hover:bg-subtle-hover flex items-center justify-center rounded-full p-2 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {moreOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-[120]"
                onClick={() => setMoreOpen(false)}
              >
                <div
                  className="bg-background border-border fixed z-[121] w-44 rounded-xl border p-1 shadow-lg"
                  style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      handleShare(e);
                      setMoreOpen(false);
                    }}
                    className="hover:bg-subtle flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>

                  {onGenerateComments && (
                    <button
                      type="button"
                      onClick={(e) => {
                        void handleGenerateComments(e);
                        setMoreOpen(false);
                      }}
                      className="hover:bg-subtle flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate Comments
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      void handleBookmark(e);
                      setMoreOpen(false);
                    }}
                    className="hover:bg-subtle flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium"
                  >
                    <Bookmark
                      className={cn("h-4 w-4", bookmarked && "fill-current")}
                    />
                    {bookmarked ? "Unsave" : "Save"}
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        void handleDelete(e);
                        setMoreOpen(false);
                      }}
                      className="text-destructive flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>

      <div className="hidden items-center gap-0.5 md:flex">
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
              className="text-foreground bg-tooltip-bg border text-left shadow-md"
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
