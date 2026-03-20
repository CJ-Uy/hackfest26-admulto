"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
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
    <div className="mx-auto max-w-[780px] px-4 py-4">
      {/* Back */}
      <button
        onClick={() => router.push(`/scroll/${scrollId}`)}
        className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </button>

      {/* Paper card */}
      <div className="rounded-lg border border-border bg-background p-5">
        {/* Author row */}
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-semibold text-primary">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold text-foreground">{authorDisplay}</span>
              {paper.peerReviewed && (
                <BadgeCheck className="h-4 w-4 fill-blue-500 text-white" />
              )}
            </div>
            <p className="text-[14px] text-muted-foreground">
              {paper.journal}, {paper.year}
            </p>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-heading text-[24px] font-bold leading-snug text-foreground">
          {paper.title}
        </h1>

        {/* Synthesis */}
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {paper.synthesis}
        </p>

        {/* DOI link */}
        <a
          href={doiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[15px] font-semibold text-primary hover:underline"
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

      {/* Comments */}
      <div className="mt-4" key={refreshKey}>
        <DetailTabs paperId={paper.id} />
      </div>

      {/* Reply */}
      <div className="mt-3">
        <ReplyInput paperId={paper.id} onCommentAdded={handleCommentAdded} />
      </div>
    </div>
  );
}
