"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment about this paper..."
        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        disabled={loading}
      />
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0"
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
