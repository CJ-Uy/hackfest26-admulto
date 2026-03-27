"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink, Globe } from "lucide-react";
import type { Paper } from "@/lib/types";
import { getAvatarColor } from "@/lib/utils";
import { CardActions } from "@/components/feed/CardActions";
import { DetailTabs } from "./DetailTabs";

interface PostDetailProps {
  paper: Paper;
  scrollId: string;
  scrollPapers?: {
    id: string;
    title: string;
    authors: string[];
    doi: string;
  }[];
  disableAiComments?: boolean;
}

export function PostDetail({
  paper,
  scrollId,
  scrollPapers = [],
  disableAiComments = false,
}: PostDetailProps) {
  const router = useRouter();

  const isWebSource = paper.authors.length === 0 && !!paper.doi?.startsWith("http");
  const authorDisplay = isWebSource
    ? "Web Search"
    : paper.authors.length > 1
      ? `${paper.authors[0]} & ${paper.authors[1]}`
      : paper.authors[0] || "Unknown";
  const initial = (paper.authors[0] ?? "U").charAt(0).toUpperCase();
  const doiUrl = paper.doi.startsWith("http")
    ? paper.doi
    : `https://doi.org/${paper.doi}`;

  return (
    <div>
      {/* Back */}
      <div className="bg-background border-border sticky top-14 z-30 border-b px-4 pt-2 pb-2">
        <button
          onClick={() => router.push(`/schroll/${scrollId}`)}
          className="text-muted-foreground hover:text-foreground mb-0.5 flex items-center gap-1.5 text-[15px] font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </button>
      </div>

      {/* Paper card — px-4 on individual sections while keeping image slightly inset */}
      <div className="border-border border-b overflow-hidden">
        {/* Author row */}
        <div className="mb-2 flex items-center gap-2.5 px-4 pt-3">
          {isWebSource ? (
            <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <Globe className="text-muted-foreground h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ backgroundColor: getAvatarColor(paper.authors[0] || "U") }}>
              {initial}
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className={`truncate text-[15px] font-semibold ${isWebSource ? "text-muted-foreground" : "text-foreground"}`}>
              {authorDisplay}
            </span>
            {paper.peerReviewed && (
              <BadgeCheck className="h-4 w-4 shrink-0 fill-blue-500 text-white" />
            )}
            <span className="text-muted-foreground truncate text-[14px]">
              {paper.journal} &middot; {paper.year}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-heading text-foreground mb-1 px-4 text-[20px] leading-snug font-bold">
          {paper.title}
        </h1>

        {/* Figure image (when available from open-access PDF) */}
        {paper.imageUrl && (
          <div className="bg-muted mb-2 mx-1 overflow-hidden rounded-md shadow-sm">
            <img
              src={paper.imageUrl}
              alt={`Figure from ${paper.title}`}
              className="w-full max-h-120 object-cover object-top"
              loading="lazy"
            />
          </div>
        )}

        {/* Synthesis — full text, not clamped */}
        <p className="text-muted-foreground px-4 text-[15px] leading-relaxed">
          {paper.synthesis}
        </p>

        {/* DOI link */}
        <a
          href={doiUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary mt-2 px-4 inline-flex items-center gap-1 text-[14px] font-semibold hover:underline"
        >
          View Full Paper
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Actions — same as feed card */}
        <div className="px-4 pb-3">
          <CardActions
            paperId={paper.id}
            credibilityScore={paper.credibilityScore}
            commentCount={paper.commentCount}
            citationCount={paper.citationCount}
            apaCitation={paper.apaCitation}
            initialVoted={paper.voted}
            initialDownvoted={paper.downvoted}
            initialBookmarked={paper.bookmarked}
          />
        </div>
      </div>

      {/* Comments — includes reply input at bottom */}
      <div className="px-4 py-3">
        <DetailTabs
          paperId={paper.id}
          scrollId={scrollId}
          scrollPapers={scrollPapers}
          disableAiComments={disableAiComments}
          showReplyInput
        />
      </div>
    </div>
  );
}
