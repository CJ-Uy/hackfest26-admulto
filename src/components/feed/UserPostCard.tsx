"use client";

import { User } from "lucide-react";
import type { UserPost } from "@/lib/types";

interface UserPostCardProps {
  post: UserPost;
}

export function UserPostCard({ post }: UserPostCardProps) {
  const timeAgo = getTimeAgo(new Date(post.createdAt));

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8]">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-[13px] font-semibold text-foreground">You</span>
        <span className="text-[12px] text-muted-foreground">&middot; {timeAgo}</span>
      </div>
      {post.title && (
        <h3 className="font-heading text-[14px] font-bold text-foreground mb-0.5">
          {post.title}
        </h3>
      )}
      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
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
