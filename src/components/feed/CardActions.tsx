"use client";

import { useState } from "react";
import { ArrowBigUp, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CardActionsProps {
  credibilityScore: number;
  commentCount: number;
  citationCount: number;
  apaCitation: string;
  onCommentClick?: () => void;
}

export function CardActions({
  credibilityScore,
  commentCount,
  citationCount,
  apaCitation,
  onCommentClick,
}: CardActionsProps) {
  const [upvoted, setUpvoted] = useState(false);
  const [score, setScore] = useState(credibilityScore);

  function handleUpvote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (upvoted) {
      setScore(credibilityScore);
    } else {
      setScore(credibilityScore + 1);
    }
    setUpvoted(!upvoted);
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

  const formattedCitations = citationCount >= 1000
    ? `${(citationCount / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : String(citationCount);

  return (
    <div className="flex items-center gap-1 pt-3">
      <button
        onClick={handleUpvote}
        className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          upvoted
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <ArrowBigUp
          className={cn("h-4 w-4", upvoted && "fill-primary")}
        />
        {score}
      </button>

      <button
        onClick={handleCommentClick}
        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {commentCount} {commentCount === 1 ? "citation" : "citations"}
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Share2 className="h-3.5 w-3.5" />
        {formattedCitations} shares
      </button>
    </div>
  );
}
