"use client";

import { useState, useRef } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ComposeBoxProps {
  scrollId: string;
}

export function ComposeBox({ scrollId }: ComposeBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleFocus() {
    setExpanded(true);
  }

  async function handlePost() {
    if (!content.trim()) return;

    // For now, just show a toast - this could be extended to create actual posts
    toast.success("Note saved to this scroll session.");
    setContent("");
    setExpanded(false);
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary mt-0.5">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          {expanded ? (
            <>
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a thought, question, or note about your research..."
                className="min-h-[80px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                autoFocus
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExpanded(false);
                    setContent("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePost}
                  disabled={!content.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                  Post
                </Button>
              </div>
            </>
          ) : (
            <button
              onClick={handleFocus}
              className="w-full rounded-full border border-border bg-muted/30 px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
            >
              Share a thought about your research...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
