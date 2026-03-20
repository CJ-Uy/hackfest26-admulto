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
      <h3 className="text-[16px] font-bold text-foreground mb-3">
        Comments ({comments.length})
      </h3>

      <div className="space-y-2.5">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-background p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8] text-[13px] font-bold text-muted-foreground">
                {c.author.charAt(0).toUpperCase()}
              </div>
              <span className="text-[15px] font-semibold text-foreground">{c.author}</span>
              <span className="text-[13px] text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-foreground">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="py-6 text-center text-[15px] text-muted-foreground">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
