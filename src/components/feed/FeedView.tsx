"use client";

import type { Paper, Poll } from "@/lib/types";
import { PaperCard } from "./PaperCard";
import { ComposeBox } from "./ComposeBox";
import { FeedPollCard } from "./FeedPollCard";

interface FeedViewProps {
  scrollId: string;
  papers: Paper[];
  polls: Poll[];
  searchQuery: string;
  onUpvote: (paperId: string, voted: boolean) => void;
  onComment: (paperId: string) => void;
}

export function FeedView({
  scrollId,
  papers,
  polls,
  searchQuery,
  onUpvote,
  onComment,
}: FeedViewProps) {
  const query = searchQuery.toLowerCase();

  const filteredPapers = query
    ? papers.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.synthesis.toLowerCase().includes(query) ||
          p.authors.some((a) => a.toLowerCase().includes(query)) ||
          p.journal.toLowerCase().includes(query)
      )
    : papers;

  if (papers.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No papers found. Try a different topic.
        </p>
      </div>
    );
  }

  // Interleave polls into the feed - insert a poll every 3-4 papers
  const feedItems: { type: "paper" | "poll"; data: Paper | Poll; index: number }[] = [];
  let pollIndex = 0;

  filteredPapers.forEach((paper, i) => {
    feedItems.push({ type: "paper", data: paper, index: i });

    // Insert a poll after every 3rd paper
    if ((i + 1) % 3 === 0 && pollIndex < polls.length) {
      feedItems.push({ type: "poll", data: polls[pollIndex], index: pollIndex });
      pollIndex++;
    }
  });

  return (
    <div>
      {/* Compose box - "What's happening" style */}
      <ComposeBox scrollId={scrollId} />

      {/* Feed items */}
      {feedItems.map((item) =>
        item.type === "paper" ? (
          <PaperCard
            key={`paper-${(item.data as Paper).id}`}
            paper={item.data as Paper}
            scrollId={scrollId}
            index={item.index}
            onUpvote={onUpvote}
            onComment={onComment}
          />
        ) : (
          <FeedPollCard
            key={`poll-${(item.data as Poll).id}`}
            poll={item.data as Poll}
          />
        )
      )}

      {filteredPapers.length === 0 && query && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No papers match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
