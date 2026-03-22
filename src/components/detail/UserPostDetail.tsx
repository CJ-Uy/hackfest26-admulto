"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, User, MessageSquare } from "lucide-react";
import type { UserPost } from "@/lib/types";
import { DetailTabs } from "./DetailTabs";

interface UserPostDetailProps {
  post: UserPost;
  scrollId: string;
  scrollPapers?: {
    id: string;
    title: string;
    authors: string[];
    doi: string;
  }[];
}

export function UserPostDetail({
  post,
  scrollId,
  scrollPapers = [],
}: UserPostDetailProps) {
  const router = useRouter();
  const timeAgo = getTimeAgo(new Date(post.createdAt));

  return (
    <div className="mx-auto max-w-[780px] px-4 pt-14 pb-4 md:pt-4">
      {/* Back */}
      <button
        onClick={() => router.push(`/schroll/${scrollId}`)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-[15px] font-semibold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </button>

      {/* Post card — matching feed card style */}
      <div className="border-border border-b px-1 pb-3">
        {/* Author row */}
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8]">
            <User className="text-muted-foreground h-4 w-4" />
          </div>
          <span className="text-foreground text-[15px] font-semibold">You</span>
          <span className="text-muted-foreground text-[14px]">
            &middot; {timeAgo}
          </span>
        </div>

        {/* Title */}
        {post.title && (
          <h1 className="font-heading text-foreground mb-1 text-[20px] leading-snug font-bold">
            {post.title}
          </h1>
        )}

        {/* Content */}
        <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Comment count */}
        <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[14px]">
          <MessageSquare className="h-4 w-4" />
          <span>{post.commentCount} comments</span>
        </div>
      </div>

      {/* Comments — includes reply input */}
      <div className="mt-4">
        <DetailTabs
          userPostId={post.id}
          scrollId={scrollId}
          scrollPapers={scrollPapers}
          showReplyInput
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
