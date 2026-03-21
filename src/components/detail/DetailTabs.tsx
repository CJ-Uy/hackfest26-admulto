"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  GitBranch,
  Quote,
  HelpCircle,
  MessageCircleReply,
  Bot,
  Reply,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Comment } from "@/lib/types";

interface DetailTabsProps {
  paperId: string;
}

const relationshipConfig: Record<
  string,
  { label: string; icon: typeof ThumbsUp; color: string; bg: string }
> = {
  agrees: {
    label: "Agrees",
    icon: ThumbsUp,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  disagrees: {
    label: "Disagrees",
    icon: ThumbsDown,
    color: "text-red-500",
    bg: "bg-red-50",
  },
  extends: {
    label: "Built on this",
    icon: GitBranch,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  cites: {
    label: "Cited this",
    icon: Quote,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  questions: {
    label: "Questions",
    icon: HelpCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  responds: {
    label: "Replied",
    icon: MessageCircleReply,
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

function RelationshipBadge({ relationship }: { relationship: string }) {
  const config = relationshipConfig[relationship];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.color} ${config.bg}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="border-border bg-muted/30 my-2 ml-8 flex items-center gap-3 rounded-md border p-3.5">
      <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
          <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
          <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
        </div>
        <span className="text-muted-foreground ml-1 text-[13px]">
          Researcher is typing...
        </span>
      </div>
    </div>
  );
}

function InlineReplyInput({
  paperId,
  parentId,
  onSubmit,
  onCancel,
}: {
  paperId: string;
  parentId: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
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
          parentId,
        }),
      });
      if (res.ok) {
        setContent("");
        onSubmit();
      } else {
        toast.error("Failed to reply.");
      }
    } catch {
      toast.error("Failed to reply.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-border ml-8 mt-2 flex items-center gap-2 rounded-md border bg-[#f6f7f8] px-3 py-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Write a reply..."
        disabled={loading}
        className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-[14px] outline-none"
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
        className="text-primary text-[13px] font-semibold disabled:opacity-30"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reply"}
      </button>
      <button
        onClick={onCancel}
        className="text-muted-foreground text-[13px]"
      >
        Cancel
      </button>
    </div>
  );
}

export function DetailTabs({ paperId }: DetailTabsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [waitingForReply, setWaitingForReply] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?paperId=${paperId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data as Comment[]);
      }
    } catch {
      // ignore
    }
  }, [paperId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Poll for AI reply when waiting
  useEffect(() => {
    if (!waitingForReply) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/comments?paperId=${paperId}`);
      if (!res.ok) return;
      const data = (await res.json()) as Comment[];

      // Check if we got a reply to the comment we're waiting on
      const hasReply = data.some(
        (c) => c.parentId === waitingForReply && c.isGenerated,
      );
      if (hasReply) {
        setComments(data);
        setWaitingForReply(null);
      }
    }, 2000);

    // Timeout after 60 seconds
    const timeout = setTimeout(() => {
      setWaitingForReply(null);
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [waitingForReply, paperId]);

  function handleReplySubmitted() {
    // Find the latest user comment (the one we just posted) and wait for AI reply
    loadComments().then(() => {
      // After refresh, set waiting state for the latest user comment
      setReplyingTo(null);
    });
    // We need to poll for the AI reply — set a temporary waiting ID
    // The comment just created will have its reply come in via polling
    setTimeout(async () => {
      const res = await fetch(`/api/comments?paperId=${paperId}`);
      if (!res.ok) return;
      const data = (await res.json()) as Comment[];
      setComments(data);
      // Find the latest user comment to wait for its AI reply
      const latestUserComment = data.find(
        (c) => !c.isGenerated && c.author === "You",
      );
      if (latestUserComment) {
        setWaitingForReply(latestUserComment.id);
      }
    }, 500);
  }

  // Build thread structure
  const generated = comments.filter(
    (c) => c.isGenerated && !c.parentId,
  );
  const userComments = comments.filter(
    (c) => !c.isGenerated && !c.parentId,
  );

  function getReplies(commentId: string): Comment[] {
    return comments
      .filter((c) => c.parentId === commentId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  function renderComment(
    c: Comment,
    depth = 0,
    showReplyButton = true,
  ) {
    const replies = getReplies(c.id);
    const isWaiting = waitingForReply === c.id;

    return (
      <div key={c.id}>
        <div
          className={`border-border rounded-md border p-3.5 ${
            c.isGenerated ? "bg-muted/30" : "bg-background"
          } ${depth > 0 ? "ml-8 mt-2" : ""}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                c.isGenerated
                  ? "bg-primary/10 text-primary"
                  : "bg-[#f6f7f8] text-muted-foreground"
              }`}
            >
              {c.author.charAt(0).toUpperCase()}
            </div>
            <span
              className={`text-[${c.isGenerated ? "14" : "15"}px] text-foreground font-semibold`}
            >
              {c.author}
            </span>
            {c.relationship && (
              <RelationshipBadge relationship={c.relationship} />
            )}
            {!c.isGenerated && (
              <span className="text-muted-foreground text-[13px]">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p
            className={`text-foreground text-[${c.isGenerated ? "14" : "15"}px] leading-relaxed`}
          >
            {c.content}
          </p>

          {/* Reply button */}
          {showReplyButton && c.isGenerated && (
            <button
              onClick={() => setReplyingTo(c.id)}
              className="text-muted-foreground hover:text-primary mt-2 flex items-center gap-1 text-[13px] transition-colors"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
        </div>

        {/* Replies */}
        {replies.map((r) => renderComment(r, depth + 1, false))}

        {/* Inline reply input */}
        {replyingTo === c.id && (
          <InlineReplyInput
            paperId={paperId}
            parentId={c.id}
            onSubmit={handleReplySubmitted}
            onCancel={() => setReplyingTo(null)}
          />
        )}

        {/* Typing indicator while waiting for AI reply */}
        {isWaiting && <TypingIndicator />}
      </div>
    );
  }

  return (
    <div>
      {/* AI-generated "reactions" from other papers */}
      {generated.length > 0 && (
        <div className="mb-5">
          <h3 className="text-foreground mb-3 flex items-center gap-2 text-[16px] font-bold">
            <Bot className="text-muted-foreground h-4 w-4" />
            What other researchers say ({generated.length})
          </h3>

          <div className="space-y-2.5">
            {generated.map((c) => renderComment(c))}
          </div>
        </div>
      )}

      {/* User comments */}
      <h3 className="text-foreground mb-3 text-[16px] font-bold">
        Comments ({userComments.length})
      </h3>

      <div className="space-y-2.5">
        {userComments.map((c) => renderComment(c, 0, false))}
        {userComments.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-[15px]">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
