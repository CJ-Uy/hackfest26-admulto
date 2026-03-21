"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, MessageSquare } from "lucide-react";
import type { UserPost } from "@/lib/types";
import { DetailTabs } from "./DetailTabs";
import { ReplyInput } from "./ReplyInput";

interface UserPostDetailProps {
  post: UserPost;
  scrollId: string;
}

export function UserPostDetail({ post, scrollId }: UserPostDetailProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCommentAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const timeAgo = getTimeAgo(new Date(post.createdAt));

  return (
    <div className="mx-auto max-w-[780px] px-4 py-4">
      {/* Back */}
      <button
        onClick={() => router.push(`/scroll/${scrollId}`)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-[15px] font-semibold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </button>

      {/* Post card */}
      <div className="border-border bg-background rounded-lg border p-5">
        {/* Author row */}
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8]">
            <User className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <span className="text-foreground text-[15px] font-semibold">
              You
            </span>
            <p className="text-muted-foreground text-[14px]">{timeAgo}</p>
          </div>
        </div>

        {/* Title */}
        {post.title && (
          <h1 className="font-heading text-foreground text-[24px] leading-snug font-bold">
            {post.title}
          </h1>
        )}

        {/* Content */}
        <p className="text-foreground mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Comment count */}
        <div className="mt-4 flex items-center gap-1.5 text-muted-foreground text-[14px]">
          <MessageSquare className="h-4 w-4" />
          <span>{post.commentCount} comments</span>
        </div>
      </div>

      {/* Comments */}
      <div className="mt-4" key={refreshKey}>
        <DetailTabs userPostId={post.id} />
      </div>

      {/* Reply */}
      <div className="mt-3">
        <ReplyInput
          userPostId={post.id}
          onCommentAdded={handleCommentAdded}
        />
      </div>
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
