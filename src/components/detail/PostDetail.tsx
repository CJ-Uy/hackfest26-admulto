"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Paper } from "@/lib/types";
import { CardActions } from "@/components/feed/CardActions";
import { DetailTabs } from "./DetailTabs";
import { ReplyInput } from "./ReplyInput";

interface PostDetailProps {
  paper: Paper;
  scrollId: string;
}

export function PostDetail({ paper, scrollId }: PostDetailProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const authorDisplay = paper.authors.join(", ");
  const initial = (paper.authors[0] ?? "U").charAt(0).toUpperCase();
  const doiUrl = paper.doi.startsWith("http")
    ? paper.doi
    : `https://doi.org/${paper.doi}`;

  const handleCommentAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1.5 text-muted-foreground"
        onClick={() => router.push(`/scroll/${scrollId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Button>

      {/* Paper card */}
      <div className="animate-fade-in rounded-lg border border-border bg-card p-6">
        {/* Author row */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{authorDisplay}</span>
              {paper.peerReviewed && (
                <BadgeCheck className="h-4 w-4 fill-blue-500 text-white" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {paper.journal}, {paper.year}
            </p>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-heading text-xl font-bold leading-snug tracking-tight md:text-2xl">
          {paper.title}
        </h1>

        {/* Synthesis */}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {paper.synthesis}
        </p>

        {/* DOI link */}
        <a
          href={doiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View Full Paper
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Actions */}
        <CardActions
          paperId={paper.id}
          credibilityScore={paper.credibilityScore}
          commentCount={paper.commentCount}
          citationCount={paper.citationCount}
          apaCitation={paper.apaCitation}
          initialVoted={paper.voted}
        />
      </div>

      {/* Comments section */}
      <div className="mt-6" key={refreshKey}>
        <DetailTabs paperId={paper.id} />
      </div>

      {/* Reply input */}
      <div className="mt-4">
        <ReplyInput paperId={paper.id} onCommentAdded={handleCommentAdded} />
      </div>
    </div>
  );
}
