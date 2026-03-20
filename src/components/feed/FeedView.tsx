"use client";

import type { Paper, Poll, UserPost } from "@/lib/types";
import { PaperCard } from "./PaperCard";
import { ComposeBox } from "./ComposeBox";
import { FeedPollCard } from "./FeedPollCard";
import { UserPostCard } from "./UserPostCard";

interface FeedViewProps {
  scrollId: string;
  papers: Paper[];
  polls: Poll[];
  searchQuery: string;
  userPosts: UserPost[];
  commentCounts: Map<string, number>;
  onUpvote: (paperId: string, voted: boolean) => void;
  onBookmark: (paperId: string, bookmarked: boolean) => void;
  onComment: (paperId: string) => void;
}

export function FeedView({
  scrollId,
  papers,
  polls,
  searchQuery,
  userPosts,
  commentCounts,
  onUpvote,
  onBookmark,
  onComment,
}: FeedViewProps) {
  const query = searchQuery.toLowerCase();

  const filteredPapers = query
    ? papers.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.synthesis.toLowerCase().includes(query) ||
          p.authors.some((a) => a.toLowerCase().includes(query)) ||
          p.journal.toLowerCase().includes(query),
      )
    : papers;

  if (papers.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-[15px]">
          No papers found. Try a different topic.
        </p>
      </div>
    );
  }

  // Interleave polls into the feed
  const feedItems: {
    type: "paper" | "poll";
    data: Paper | Poll;
    index: number;
  }[] = [];
  let pollIndex = 0;

  filteredPapers.forEach((paper, i) => {
    feedItems.push({ type: "paper", data: paper, index: i });
    if ((i + 1) % 3 === 0 && pollIndex < polls.length) {
      feedItems.push({
        type: "poll",
        data: polls[pollIndex],
        index: pollIndex,
      });
      pollIndex++;
    }
  });

  return (
    <div>
      <ComposeBox scrollId={scrollId} />

      {/* User posts at top */}
      {userPosts.map((post) => (
        <UserPostCard key={post.id} post={post} />
      ))}

      {/* Feed items */}
      {feedItems.map((item) =>
        item.type === "paper" ? (
          <PaperCard
            key={`paper-${(item.data as Paper).id}`}
            paper={item.data as Paper}
            scrollId={scrollId}
            index={item.index}
            commentCount={
              commentCounts.get((item.data as Paper).id) ??
              (item.data as Paper).commentCount
            }
            onUpvote={onUpvote}
            onBookmark={onBookmark}
            onComment={onComment}
          />
        ) : (
          <FeedPollCard
            key={`poll-${(item.data as Poll).id}`}
            poll={item.data as Poll}
          />
        ),
      )}

      {filteredPapers.length === 0 && query && (
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground text-[15px]">
            No papers match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
