"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";
import type { UserPost } from "@/lib/types";

interface ComposeBoxProps {
  scrollId: string;
  onPost?: (post: UserPost) => void;
}

export function ComposeBox({ scrollId, onPost }: ComposeBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handlePost() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/user-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollId, content: content.trim() }),
      });

      if (res.ok) {
        const saved = (await res.json()) as {
          id: string;
          title?: string | null;
          content: string;
          commentCount: number;
          createdAt: string;
        };
        const post: UserPost = {
          id: saved.id,
          title: saved.title ?? undefined,
          content: saved.content,
          commentCount: saved.commentCount ?? 0,
          createdAt: saved.createdAt,
        };
        onPost?.(post);
        setContent("");
        setExpanded(false);
      } else {
        toast.error("Failed to create post");
      }
    } catch {
      toast.error("Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-border border-b px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle">
          <User className="text-muted-foreground h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          {expanded ? (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a thought about your research..."
                className="text-foreground placeholder:text-muted-foreground min-h-[70px] w-full resize-none border-0 bg-transparent p-0 text-[15px] focus:outline-none"
                autoFocus
              />
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setExpanded(false);
                    setContent("");
                  }}
                  className="text-muted-foreground rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors hover:bg-subtle"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!content.trim() || submitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors disabled:opacity-40"
                >
                  {submitting ? "Posting..." : "Post"}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="border-border text-muted-foreground w-full rounded-full border bg-subtle px-4 py-2 text-left text-[15px] transition-colors hover:border-subtle-hover"
            >
              Create a post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
