"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface ReplyInputProps {
  paperId: string;
  parentId?: string;
  onCommentAdded?: (commentId?: string) => void;
}

export function ReplyInput({ paperId, parentId, onCommentAdded }: ReplyInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          content: content.trim(),
          parentId: parentId || undefined,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setContent("");
        toast.success("Comment added!");
        onCommentAdded?.(data.id);
      } else {
        toast.error("Failed to add comment.");
      }
    } catch {
      toast.error("Failed to add comment.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-border bg-background flex items-center gap-2 rounded-md border px-3.5 py-2.5">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        disabled={loading}
        className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-[15px] outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
        className="text-primary hover:bg-primary/10 shrink-0 rounded-full p-2 transition-colors disabled:opacity-30"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
