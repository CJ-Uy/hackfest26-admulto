"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import type { Paper } from "@/lib/types";
import { CardActions } from "./CardActions";

interface PaperCardProps {
  paper: Paper;
  scrollId: string;
  index: number;
}

export function PaperCard({ paper, scrollId, index }: PaperCardProps) {
  const router = useRouter();

  const primaryAuthor = paper.authors[0] ?? "Unknown";
  const authorDisplay =
    paper.authors.length > 1
      ? `${paper.authors[0]} & ${paper.authors[1]}`
      : paper.authors[0];
  const initial = primaryAuthor.charAt(0).toUpperCase();

  function navigateToDetail() {
    router.push(`/scroll/${scrollId}/post/${paper.id}`);
  }

  return (
    <article
      className="animate-card-enter cursor-pointer rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={navigateToDetail}
    >
      {/* Author row */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initial}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{authorDisplay}</span>
          {paper.peerReviewed && (
            <BadgeCheck className="h-4 w-4 fill-blue-500 text-white" />
          )}
          <span className="text-xs text-muted-foreground">
            &middot; {paper.journal}, {paper.year}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-heading mb-2 text-base font-bold leading-snug tracking-tight">
        {paper.title}
      </h3>

      {/* Synthesis */}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {paper.synthesis}
      </p>

      {/* Actions */}
      <CardActions
        credibilityScore={paper.credibilityScore}
        commentCount={paper.commentCount}
        citationCount={paper.citationCount}
        apaCitation={paper.apaCitation}
        onCommentClick={navigateToDetail}
      />
    </article>
  );
}
