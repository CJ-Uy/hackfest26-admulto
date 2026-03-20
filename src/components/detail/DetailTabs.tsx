"use client";

import { useState, useEffect } from "react";
import type { Comment } from "@/lib/types";

interface DetailTabsProps {
  paperId: string;
}

export function DetailTabs({ paperId }: DetailTabsProps) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    async function loadComments() {
      try {
        const res = await fetch(`/api/comments?paperId=${paperId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data as Comment[]);
        }
      } catch {
        // ignore
      }
    }
    loadComments();
  }, [paperId]);

  return (
    <div>
      <h3 className="text-foreground mb-3 text-[16px] font-bold">
        Comments ({comments.length})
      </h3>

      <div className="space-y-2.5">
        {comments.map((c) => (
          <div
            key={c.id}
            className="border-border bg-background rounded-md border p-3.5"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8] text-[13px] font-bold">
                {c.author.charAt(0).toUpperCase()}
              </div>
              <span className="text-foreground text-[15px] font-semibold">
                {c.author}
              </span>
              <span className="text-muted-foreground text-[13px]">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-foreground text-[15px] leading-relaxed">
              {c.content}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-[15px]">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
