"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface ReplyInputProps {
  paperId: string;
  onCommentAdded?: () => void;
}

export function ReplyInput({ paperId, onCommentAdded }: ReplyInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, content: content.trim() }),
      });

      if (res.ok) {
        setContent("");
        toast.success("Comment added!");
        onCommentAdded?.();
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
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2.5">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        disabled={loading}
        className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
        className="shrink-0 rounded-full p-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
