"use client";

import { User } from "lucide-react";
import type { UserPost } from "@/lib/types";

interface UserPostCardProps {
  post: UserPost;
}

export function UserPostCard({ post }: UserPostCardProps) {
  const timeAgo = getTimeAgo(new Date(post.createdAt));

  return (
    <div className="border-border border-b px-4 py-3">
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
      <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>
    </div>
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
