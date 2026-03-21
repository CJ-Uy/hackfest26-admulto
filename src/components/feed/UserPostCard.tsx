"use client";

import { useRouter } from "next/navigation";
import { User, MessageSquare } from "lucide-react";
import type { UserPost } from "@/lib/types";

interface UserPostCardProps {
  post: UserPost;
  scrollId: string;
  commentCount?: number;
}

export function UserPostCard({ post, scrollId, commentCount }: UserPostCardProps) {
  const router = useRouter();
  const timeAgo = getTimeAgo(new Date(post.createdAt));
  const displayCount = commentCount ?? post.commentCount ?? 0;

  return (
    <article
      className="border-border cursor-pointer border-b px-4 py-3 transition-colors hover:bg-[#fafafa]"
      onClick={() => router.push(`/scroll/${scrollId}/userpost/${post.id}`)}
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
      <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap line-clamp-4">
        {post.content}
      </p>
      {displayCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-[13px]">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{displayCount} {displayCount === 1 ? "comment" : "comments"}</span>
        </div>
      )}
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
