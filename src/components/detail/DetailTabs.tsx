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
  Sparkles,
  Trash2,
  ExternalLink,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useCommentStream } from "@/hooks/useCommentStream";
import type { Comment } from "@/lib/types";

interface ScrollPaperRef {
  id: string;
  title: string;
  authors: string[];
  doi: string;
}

interface DetailTabsProps {
  paperId?: string;
  userPostId?: string;
  scrollId: string;
  scrollPapers?: ScrollPaperRef[];
  showReplyInput?: boolean;
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

function TypingIndicator({ depth = 0 }: { depth?: number }) {
  return (
    <div
      className="border-border/50 my-1 flex items-center gap-3 border-l-2 py-2"
      style={{
        paddingLeft: `${Math.min(depth + 1, 5) * 1.25 + 0.75}rem`,
      }}
    >
      <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
        <Bot className="h-3 w-3" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
          <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
          <span className="bg-primary/40 inline-block h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
        </div>
        <span className="text-muted-foreground ml-1 text-[12px]">
          Researcher is typing...
        </span>
      </div>
    </div>
  );
}

function InlineReplyInput({
  paperId,
  userPostId,
  parentId,
  depth,
  onSubmit,
  onCancel,
}: {
  paperId?: string;
  userPostId?: string;
  parentId: string;
  depth: number;
  onSubmit: (commentId: string) => void;
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
          ...(userPostId ? { userPostId } : { paperId }),
          content: content.trim(),
          parentId,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setContent("");
        onSubmit(data.id);
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
    <div
      className="border-border/50 border-l-2 py-1"
      style={{ paddingLeft: `${Math.min(depth + 1, 5) * 1.25 + 0.75}rem` }}
    >
      <div className="bg-subtle flex items-center gap-2 rounded-md px-3 py-2">
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
    </div>
  );
}

export function DetailTabs({
  paperId,
  userPostId,
  scrollId,
  scrollPapers = [],
  showReplyInput = false,
}: DetailTabsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [generatingComments, setGeneratingComments] = useState(false);
  // Track comment IDs that are waiting for AI replies (typing indicator)
  const [waitingForReply, setWaitingForReply] = useState<Set<string>>(
    new Set(),
  );
  // Main reply input state
  const [mainReplyContent, setMainReplyContent] = useState("");
  const [mainReplyLoading, setMainReplyLoading] = useState(false);

  const queryParam = userPostId
    ? `userPostId=${userPostId}`
    : `paperId=${paperId}`;

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data as Comment[]);
      }
    } catch {
      // ignore
    }
  }, [queryParam]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Live comment stream — new comments arrive via SSE
  useCommentStream({
    scrollId,
    onComment: useCallback(
      (comment: Comment) => {
        // Only process comments for this paper/post
        const isRelevant = userPostId
          ? comment.userPostId === userPostId
          : comment.paperId === paperId && !comment.userPostId;

        if (!isRelevant) return;

        setComments((prev) => {
          // Don't add duplicates
          if (prev.some((c) => c.id === comment.id)) return prev;
          return [...prev, comment];
        });

        // If this is an AI reply to a comment we were waiting on, clear the indicator
        if (comment.isGenerated && comment.parentId) {
          setWaitingForReply((prev) => {
            if (!prev.has(comment.parentId!)) return prev;
            const next = new Set(prev);
            next.delete(comment.parentId!);
            return next;
          });
        }
      },
      [paperId, userPostId],
    ),
  });

  function handleReplySubmitted(commentId: string) {
    // Reload to get the new comment immediately
    loadComments();
    setReplyingTo(null);
    // Show typing indicator for the AI reply
    setWaitingForReply((prev) => new Set(prev).add(commentId));
    // Safety timeout: clear after 90 seconds
    setTimeout(() => {
      setWaitingForReply((prev) => {
        if (!prev.has(commentId)) return prev;
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }, 90000);
  }

  // Main reply input submit handler
  async function handleMainReplySubmit() {
    if (!mainReplyContent.trim() || mainReplyLoading) return;
    setMainReplyLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(userPostId ? { userPostId } : { paperId }),
          content: mainReplyContent.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setMainReplyContent("");
        toast.success("Comment added!");
        // Reload comments and show typing indicator
        loadComments();
        setWaitingForReply((prev) => new Set(prev).add(data.id));
        setTimeout(() => {
          setWaitingForReply((prev) => {
            if (!prev.has(data.id)) return prev;
            const next = new Set(prev);
            next.delete(data.id);
            return next;
          });
        }, 90000);
      } else {
        toast.error("Failed to add comment.");
      }
    } catch {
      toast.error("Failed to add comment.");
    } finally {
      setMainReplyLoading(false);
    }
  }

  // Find the source paper for a generated comment by matching author name.
  // LLM-generated author names may use just the last name or vary in format,
  // so we try exact match first, then fall back to last-name matching.
  function findSourcePaper(authorName: string): ScrollPaperRef | undefined {
    const normalised = authorName
      .replace(/\s*et\s*al\.?\s*$/i, "")
      .trim()
      .toLowerCase();

    // Exact match first
    const exact = scrollPapers.find((p) => {
      const firstAuthor = p.authors[0];
      if (!firstAuthor) return false;
      return (
        authorName === `${firstAuthor} et al.` || authorName === firstAuthor
      );
    });
    if (exact) return exact;

    // Fuzzy: match by last name (LLM often outputs "Smith et al." while author is "John Smith")
    return scrollPapers.find((p) => {
      const firstAuthor = p.authors[0];
      if (!firstAuthor) return false;
      const authorLower = firstAuthor.toLowerCase();
      // Check if the normalised comment author is the last name of the paper author
      const lastNameParts = authorLower.split(/\s+/);
      const lastName = lastNameParts[lastNameParts.length - 1];
      return (
        normalised === authorLower ||
        normalised === lastName ||
        authorLower.includes(normalised) ||
        normalised.includes(authorLower)
      );
    });
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) =>
          prev.filter((c) => c.id !== commentId && c.parentId !== commentId),
        );
        toast.success("Comment deleted");
      } else {
        toast.error("Failed to delete comment");
      }
    } catch {
      toast.error("Failed to delete comment");
    }
  }

  async function handleGenerateComments() {
    if (generatingComments) return;
    setGeneratingComments(true);
    try {
      await fetch(`/api/scrolls/${scrollId}/generate-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      toast.success("Generating new comments...");
    } catch {
      toast.error("Failed to generate comments");
    } finally {
      setGeneratingComments(false);
    }
  }

  // Build thread structure
  const generated = comments.filter((c) => c.isGenerated && !c.parentId);
  const userComments = comments.filter((c) => !c.isGenerated && !c.parentId);

  function getReplies(commentId: string): Comment[] {
    return comments
      .filter((c) => c.parentId === commentId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  function renderComment(c: Comment, depth = 0) {
    const replies = getReplies(c.id);
    const isWaiting = waitingForReply.has(c.id);
    // Try author-match first, then fall back to the paper this comment belongs to
    const sourcePaper = c.isGenerated
      ? (findSourcePaper(c.author) ??
        scrollPapers.find((p) => p.id === c.paperId))
      : undefined;

    return (
      <div key={c.id}>
        {/* Comment with left border for threading */}
        <div
          className={cn("border-border/50 py-3", depth > 0 && "border-l-2")}
          style={
            depth > 0
              ? { paddingLeft: `${Math.min(depth, 5) * 1.25}rem` }
              : undefined
          }
        >
          {/* Author row */}
          <div className="mb-1.5 flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                c.isGenerated
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground bg-subtle",
              )}
            >
              {c.isGenerated ? (
                <Bot className="h-3 w-3" />
              ) : (
                c.author.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {sourcePaper ? (
                <a
                  href={`/schroll/${scrollId}/post/${sourcePaper.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary truncate text-[13px] font-semibold hover:underline"
                  title={sourcePaper.title}
                >
                  {c.author}
                </a>
              ) : (
                <span className="text-foreground truncate text-[13px] font-semibold">
                  {c.author}
                </span>
              )}
              {c.relationship && (
                <RelationshipBadge relationship={c.relationship} />
              )}
              <span className="text-muted-foreground shrink-0 text-[11px]">
                {c.isGenerated
                  ? "AI"
                  : new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Content */}
          <p className="text-foreground ml-8 text-[14px] leading-relaxed">
            {c.content}
          </p>

          {/* Actions */}
          <div className="mt-1.5 ml-8 flex items-center gap-1">
            <button
              onClick={() => setReplyingTo(c.id)}
              className="text-muted-foreground hover:text-primary hover:bg-subtle flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-medium transition-colors"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
            {sourcePaper && (
              <a
                href={`/schroll/${scrollId}/post/${sourcePaper.id}`}
                className="text-muted-foreground hover:text-primary flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-medium transition-colors hover:bg-[#f6f7f8]"
                onClick={(e) => e.stopPropagation()}
                title={sourcePaper.title || "View source"}
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
            <button
              onClick={() => handleDeleteComment(c.id)}
              className="text-muted-foreground flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-medium transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Separator line between top-level comments */}
        {depth === 0 && <div className="border-border/40 border-b" />}

        {/* Replies */}
        {replies.map((r) => renderComment(r, depth + 1))}

        {/* Inline reply input */}
        {replyingTo === c.id && (
          <InlineReplyInput
            paperId={paperId}
            userPostId={userPostId}
            parentId={c.id}
            depth={depth}
            onSubmit={handleReplySubmitted}
            onCancel={() => setReplyingTo(null)}
          />
        )}

        {/* Typing indicator */}
        {isWaiting && <TypingIndicator depth={depth} />}
      </div>
    );
  }

  return (
    <div>
      {/* AI-generated "reactions" from other papers */}
      {generated.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-foreground flex items-center gap-2 text-[15px] font-bold">
              <Bot className="text-muted-foreground h-4 w-4" />
              What other researchers say ({generated.length})
            </h3>
            {paperId && (
              <button
                onClick={handleGenerateComments}
                disabled={generatingComments}
                className="text-muted-foreground hover:text-primary bg-subtle hover:bg-subtle-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50"
              >
                <Sparkles
                  className={`h-3.5 w-3.5 ${generatingComments ? "animate-spin" : ""}`}
                />
                Generate more
              </button>
            )}
          </div>

          <div>{generated.map((c) => renderComment(c))}</div>
        </div>
      )}

      {/* User comments */}
      <h3 className="text-foreground mb-2 text-[15px] font-bold">
        Comments ({userComments.length})
      </h3>

      <div>
        {userComments.map((c) => renderComment(c))}
        {userComments.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-[14px]">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>

      {/* Show typing indicator for main reply if waiting */}
      {Array.from(waitingForReply).some((id) => {
        const c = comments.find((co) => co.id === id);
        return c && !c.parentId;
      }) && <TypingIndicator depth={0} />}

      {/* Integrated reply input */}
      {showReplyInput && (
        <div className="border-border bg-subtle mt-4 flex items-center gap-2 rounded-md border px-3.5 py-2.5">
          <input
            value={mainReplyContent}
            onChange={(e) => setMainReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleMainReplySubmit();
              }
            }}
            placeholder="Add a comment..."
            disabled={mainReplyLoading}
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-[14px] outline-none"
          />
          <button
            onClick={handleMainReplySubmit}
            disabled={!mainReplyContent.trim() || mainReplyLoading}
            className="text-primary hover:bg-primary/10 shrink-0 rounded-full p-2 transition-colors disabled:opacity-30"
          >
            {mainReplyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
