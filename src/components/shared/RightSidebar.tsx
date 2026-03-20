"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowBigUp, MessageSquare, FileText, TrendingUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScrollSession, Paper } from "@/lib/types";

interface RightSidebarProps {
  scroll: ScrollSession;
  papers: Paper[];
  upvotedPapers: Set<string>;
  commentedPapers: Map<string, number>;
  scrollId: string;
}

export function RightSidebar({
  scroll,
  papers,
  upvotedPapers,
  commentedPapers,
  scrollId,
}: RightSidebarProps) {
  const [showAllUpvoted, setShowAllUpvoted] = useState(false);

  const upvotedList = papers.filter((p) => upvotedPapers.has(p.id));
  const displayedUpvoted = showAllUpvoted ? upvotedList : upvotedList.slice(0, 3);

  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);
  const avgCredibility = papers.length
    ? Math.round(papers.reduce((sum, p) => sum + p.credibilityScore, 0) / papers.length)
    : 0;

  return (
    <aside className="hidden w-80 shrink-0 border-l border-border lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto p-4 space-y-5">
        {/* Session stats */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Session Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs">Papers</span>
              </div>
              <p className="text-lg font-bold">{scroll.paperCount}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Avg Score</span>
              </div>
              <p className="text-lg font-bold">{avgCredibility}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ArrowBigUp className="h-3.5 w-3.5" />
                <span className="text-xs">Upvoted</span>
              </div>
              <p className="text-lg font-bold">{upvotedPapers.size}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs">Citations</span>
              </div>
              <p className="text-lg font-bold">
                {totalCitations >= 1000
                  ? `${(totalCitations / 1000).toFixed(0)}k`
                  : totalCitations}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Badge variant="secondary" className="text-xs">
              {scroll.mode === "brainstorm" ? "Brainstorm Mode" : "Citation Finder"}
            </Badge>
          </div>
        </div>

        {/* Upvoted papers */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <ArrowBigUp className="h-4 w-4 text-primary" />
            Upvoted Papers
          </h3>
          {upvotedList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No upvoted papers yet. Upvote papers to save them here.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {displayedUpvoted.map((paper) => (
                  <Link
                    key={paper.id}
                    href={`/scroll/${scrollId}/post/${paper.id}`}
                    className="block rounded-lg p-2 transition-colors hover:bg-accent"
                  >
                    <p className="text-xs font-medium leading-snug line-clamp-2">
                      {paper.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {paper.authors[0] || "Unknown"} &middot; {paper.year}
                    </p>
                  </Link>
                ))}
              </div>
              {upvotedList.length > 3 && !showAllUpvoted && (
                <button
                  onClick={() => setShowAllUpvoted(true)}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Show {upvotedList.length - 3} more
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-primary" />
            Your Activity
          </h3>
          {commentedPapers.size === 0 ? (
            <p className="text-xs text-muted-foreground">
              No comments yet. Click on a paper to leave comments.
            </p>
          ) : (
            <div className="space-y-2">
              {Array.from(commentedPapers.entries()).map(([paperId, count]) => {
                const paper = papers.find((p) => p.id === paperId);
                if (!paper) return null;
                return (
                  <Link
                    key={paperId}
                    href={`/scroll/${scrollId}/post/${paperId}`}
                    className="block rounded-lg p-2 transition-colors hover:bg-accent"
                  >
                    <p className="text-xs font-medium leading-snug line-clamp-1">
                      {paper.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {count} {count === 1 ? "comment" : "comments"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
