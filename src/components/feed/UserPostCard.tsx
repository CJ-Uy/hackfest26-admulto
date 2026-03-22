"use client";

import { useRouter } from "next/navigation";
import { User, MessageSquare, Trash2, Bot, MessageCircleReply } from "lucide-react";
import type { UserPost } from "@/lib/types";

interface UserPostCardProps {
  post: UserPost;
  scrollId: string;
  commentCount?: number;
  onDelete?: (postId: string) => void;
  isGenerating?: boolean;
  hasNewComments?: boolean;
  hasReplyNotif?: boolean;
  onClearNewComment?: () => void;
}

export function UserPostCard({
  post,
  scrollId,
  commentCount,
  onDelete,
  isGenerating,
  hasNewComments,
  hasReplyNotif,
  onClearNewComment,
}: UserPostCardProps) {
  const router = useRouter();
  const timeAgo = getTimeAgo(new Date(post.createdAt));
  const displayCount = commentCount ?? post.commentCount ?? 0;

  return (
    <article
      className="border-border cursor-pointer border-b px-4 py-3 transition-colors hover:bg-[#fafafa]"
      onClick={() => {
        onClearNewComment?.();
        router.push(`/schroll/${scrollId}/userpost/${post.id}`);
      }}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8]">
          <User className="text-muted-foreground h-4 w-4" />
        </div>
        <span className="text-foreground text-[15px] font-semibold">You</span>
        <span className="text-muted-foreground text-[14px]">
          &middot; {timeAgo}
        </span>
      </div>
      {post.title && (
        <h3 className="font-heading text-foreground mb-0.5 text-[17px] font-bold">
          {post.title}
        </h3>
      )}
      <p className="text-foreground line-clamp-4 text-[15px] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>
      {/* Reply notification */}
      {hasReplyNotif && !isGenerating && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[12px] font-medium text-blue-600">
          <MessageCircleReply className="h-3.5 w-3.5" />
          A researcher replied to your comment
        </div>
      )}

      {/* AI generating indicator */}
      {isGenerating && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-[#f6f7f8] px-3 py-2">
          <Bot className="text-primary h-3.5 w-3.5" />
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
              <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
              <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
            </div>
            <span className="text-muted-foreground text-[12px]">
              Researchers are responding...
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {displayCount > 0 ? (
          <div className="text-muted-foreground relative flex items-center gap-1.5 text-[13px]">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>
              {displayCount} {displayCount === 1 ? "comment" : "comments"}
            </span>
            {hasNewComments && (
              <span className="h-2 w-2 rounded-full bg-red-500" />
            )}
          </div>
        ) : (
          <div />
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(post.id);
            }}
            className="text-muted-foreground rounded-full p-1.5 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
