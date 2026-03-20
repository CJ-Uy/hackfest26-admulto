"use client";

import { useState } from "react";
import { User } from "lucide-react";

interface ComposeBoxProps {
  scrollId: string;
}

export function ComposeBox({ scrollId }: ComposeBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");

  function handlePost() {
    if (!content.trim()) return;
    // Posts are handled by the parent via CreatePostFAB or inline
    setContent("");
    setExpanded(false);
  }

  return (
    <div className="border-b border-border px-4 py-2.5">
      <div className="flex gap-2.5 items-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f6f7f8] mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          {expanded ? (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a thought about your research..."
                className="w-full resize-none border-0 bg-transparent p-0 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[60px]"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  onClick={() => { setExpanded(false); setContent(""); }}
                  className="px-3 py-1 rounded-full text-[12px] font-semibold text-muted-foreground hover:bg-[#f6f7f8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!content.trim()}
                  className="px-4 py-1 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  Post
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="w-full rounded-full border border-border bg-[#f6f7f8] px-4 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-[#d0d0d0]"
            >
              Create a post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
