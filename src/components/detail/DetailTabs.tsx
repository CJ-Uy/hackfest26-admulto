"use client";

import { useState, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  GitBranch,
  Quote,
  HelpCircle,
  Bot,
} from "lucide-react";
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

  const generated = comments.filter((c) => c.isGenerated);
  const userComments = comments.filter((c) => !c.isGenerated);

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
            {generated.map((c) => (
              <div
                key={c.id}
                className="border-border bg-muted/30 rounded-md border p-3.5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-foreground text-[14px] font-semibold">
                    {c.author}
                  </span>
                  {c.relationship && (
                    <RelationshipBadge relationship={c.relationship} />
                  )}
                </div>
                <p className="text-foreground text-[14px] leading-relaxed">
                  {c.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User comments */}
      <h3 className="text-foreground mb-3 text-[16px] font-bold">
        Comments ({userComments.length})
      </h3>

      <div className="space-y-2.5">
        {userComments.map((c) => (
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
        {userComments.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-[15px]">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
