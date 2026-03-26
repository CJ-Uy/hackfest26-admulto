"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck, MessageCircleReply } from "lucide-react";
import type { Paper } from "@/lib/types";
import { getAvatarColor } from "@/lib/utils";
import { CardActions } from "./CardActions";

interface PaperCardProps {
  paper: Paper;
  scrollId: string;
  index: number;
  commentCount: number;
  initialBookmarked?: boolean;
  initialDownvoted?: boolean;
  onUpvote: (paperId: string, voted: boolean) => void;
  onDownvote?: (paperId: string, downvoted: boolean) => void;
  onBookmark: (paperId: string, bookmarked: boolean) => void;
  onComment: (paperId: string) => void;
  onGenerateComments?: (paperId: string) => void;
  onDelete?: (paperId: string) => void;
  hasNewComments?: boolean;
  hasReplyNotif?: boolean;
  onClearNewComment?: () => void;
}

export function PaperCard({
  paper,
  scrollId,
  index,
  commentCount,
  initialBookmarked,
  initialDownvoted,
  onUpvote,
  onDownvote,
  onBookmark,
  onComment,
  onGenerateComments,
  onDelete,
  hasNewComments,
  hasReplyNotif,
  onClearNewComment,
}: PaperCardProps) {
  const router = useRouter();

  const primaryAuthor = paper.authors[0] ?? "Unknown";
  const authorDisplay =
    paper.authors.length > 1
      ? `${paper.authors[0]} & ${paper.authors[1]}`
      : paper.authors[0] || "Unknown";
  const initial = primaryAuthor.charAt(0).toUpperCase();

  const avatarColor = getAvatarColor(primaryAuthor);

  function navigateToDetail() {
    onClearNewComment?.();
    router.push(`/schroll/${scrollId}/post/${paper.id}`);
  }

  return (
    <article
      className="animate-card-enter border-border hover:bg-muted/50 cursor-pointer overflow-hidden border-b px-4 py-3 transition-colors"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={navigateToDetail}
    >
      {/* Author row */}
      <div className="mb-2 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: avatarColor }}
        >
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

      {/* Reply notification badge */}
      {hasReplyNotif && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[12px] font-medium text-blue-600">
          <MessageCircleReply className="h-3.5 w-3.5" />A researcher replied to
          your comment
        </div>
      )}

      {/* Actions */}
      <CardActions
        paperId={paper.id}
        credibilityScore={paper.credibilityScore}
        commentCount={commentCount}
        citationCount={paper.citationCount}
        apaCitation={paper.apaCitation}
        initialVoted={paper.voted}
        initialDownvoted={initialDownvoted ?? paper.downvoted}
        initialBookmarked={initialBookmarked}
        onCommentClick={navigateToDetail}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        onBookmark={onBookmark}
        onGenerateComments={onGenerateComments}
        onDelete={onDelete}
        hasNewComments={hasNewComments}
      />
    </article>
  );
}
