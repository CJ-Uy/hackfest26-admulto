"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import type { Paper } from "@/lib/types";
import { CardActions } from "@/components/feed/CardActions";
import { DetailTabs } from "./DetailTabs";
import { ReplyInput } from "./ReplyInput";
import { GroundingPanel } from "./GroundingPanel";

interface PostDetailProps {
  paper: Paper;
  scrollId: string;
  scrollPapers?: {
    id: string;
    title: string;
    authors: string[];
    doi: string;
  }[];
}

export function PostDetail({
  paper,
  scrollId,
  scrollPapers = [],
}: PostDetailProps) {
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
    <div className="mx-auto max-w-[780px] px-4 pt-14 pb-4 md:pt-4">
      {/* Back */}
      <button
        onClick={() => router.push(`/schroll/${scrollId}`)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-[15px] font-semibold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </button>

      {/* Paper card */}
      <div className="border-border bg-background rounded-lg border p-5">
        {/* Author row */}
        <div className="mb-3 flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground text-[15px] font-semibold">
                {authorDisplay}
              </span>
              {paper.peerReviewed && (
                <BadgeCheck className="h-4 w-4 fill-blue-500 text-white" />
              )}
            </div>
            <p className="text-muted-foreground text-[14px]">
              {paper.journal}, {paper.year}
            </p>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-heading text-foreground text-[24px] leading-snug font-bold">
          {paper.title}
        </h1>

        {/* Synthesis */}
        <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
          {paper.synthesis}
        </p>

        {/* DOI link */}
        <a
          href={doiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-2 inline-flex items-center gap-1 text-[15px] font-semibold hover:underline"
        >
          View Full Paper
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Grounding verification */}
        {paper.groundingData && <GroundingPanel data={paper.groundingData} />}

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
        <DetailTabs
          paperId={paper.id}
          scrollId={scrollId}
          scrollPapers={scrollPapers}
        />
      </div>

      {/* Reply */}
      <div className="mt-3">
        <ReplyInput paperId={paper.id} onCommentAdded={handleCommentAdded} />
      </div>
    </div>
  );
}
