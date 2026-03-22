"use client";

import { useRouter } from "next/navigation";
import { Search, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Paper, Poll, UserPost } from "@/lib/types";
import { PaperCard } from "./PaperCard";
import { ComposeBox } from "./ComposeBox";
import { FeedPollCard } from "./FeedPollCard";
import { UserPostCard } from "./UserPostCard";
import { GenerateMoreProgress } from "./GenerateMoreProgress";

interface FeedViewProps {
  scrollId: string;
  papers: Paper[];
  polls: Poll[];
  searchQuery: string;
  scrollTitle?: string;
  userPosts: UserPost[];
  commentCounts: Map<string, number>;
  bookmarkedPapers: Set<string>;
  downvotedPapers?: Set<string>;
  isGeneratingMore?: boolean;
  generateMoreProgress?: {
    step: string;
    papersProcessed?: number;
    total?: number;
  } | null;
  onUpvote: (paperId: string, voted: boolean) => void;
  onDownvote?: (paperId: string, downvoted: boolean) => void;
  onBookmark: (paperId: string, bookmarked: boolean) => void;
  onComment: (paperId: string) => void;
  onGenerateMore?: () => void;
  onPost?: (post: UserPost) => void;
  onGenerateComments?: (paperId: string) => void;
  onDelete?: (paperId: string) => void;
  onDeletePost?: (postId: string) => void;
  generatingPostIds?: Set<string>;
  newCommentIds?: Set<string>;
  replyNotifIds?: Set<string>;
  onClearNewComment?: (id: string) => void;
}

export function FeedView({
  scrollId,
  papers,
  polls,
  searchQuery,
  scrollTitle,
  userPosts,
  commentCounts,
  bookmarkedPapers,
  downvotedPapers,
  isGeneratingMore,
  generateMoreProgress,
  onUpvote,
  onDownvote,
  onBookmark,
  onComment,
  onGenerateMore,
  onPost,
  onGenerateComments,
  onDelete,
  onDeletePost,
  generatingPostIds,
  newCommentIds,
  replyNotifIds,
  onClearNewComment,
}: FeedViewProps) {
  const router = useRouter();
  const query = searchQuery.toLowerCase();

  const retryUrl = scrollTitle
    ? `/onboarding?topic=${encodeURIComponent(scrollTitle)}`
    : "/onboarding";

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
      <div className="px-4 py-16 text-center">
        <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Search className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">No papers found</h2>
        <p className="text-muted-foreground mx-auto mb-6 max-w-md text-sm">
          We couldn&apos;t find papers for this topic. Try broadening your
          search or using different keywords.
        </p>
        <Button variant="outline" onClick={() => router.push(retryUrl)}>
          Try a different topic
        </Button>
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
    <div className="w-full overflow-hidden">
      {papers.length > 0 && papers.length < 3 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                We found fewer papers than expected ({papers.length}{" "}
                {papers.length === 1 ? "paper" : "papers"}).
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Try broadening your topic or using more general keywords for
                better results.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => router.push(retryUrl)}
              >
                Try again with a different topic
              </Button>
            </div>
          </div>
        </div>
      )}

      <ComposeBox scrollId={scrollId} onPost={onPost} />

      {/* User posts at top */}
      {userPosts.map((post) => (
        <UserPostCard
          key={post.id}
          post={post}
          scrollId={scrollId}
          commentCount={commentCounts.get(`post:${post.id}`)}
          onDelete={onDeletePost}
          isGenerating={generatingPostIds?.has(post.id)}
          hasNewComments={newCommentIds?.has(`post:${post.id}`)}
          hasReplyNotif={replyNotifIds?.has(`post:${post.id}`)}
          onClearNewComment={() => onClearNewComment?.(`post:${post.id}`)}
        />
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
            initialBookmarked={bookmarkedPapers.has((item.data as Paper).id)}
            initialDownvoted={downvotedPapers?.has((item.data as Paper).id)}
            onUpvote={onUpvote}
            onDownvote={onDownvote}
            onBookmark={onBookmark}
            onComment={onComment}
            onGenerateComments={onGenerateComments}
            onDelete={onDelete}
            hasNewComments={newCommentIds?.has((item.data as Paper).id)}
            hasReplyNotif={replyNotifIds?.has((item.data as Paper).id)}
            onClearNewComment={() =>
              onClearNewComment?.((item.data as Paper).id)
            }
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

      {/* Generate More */}
      {!query &&
        (isGeneratingMore ? (
          <GenerateMoreProgress progress={generateMoreProgress ?? null} />
        ) : (
          <div className="px-4 py-8 text-center">
            <Button
              variant="outline"
              onClick={onGenerateMore}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate More Papers
            </Button>
            <p className="text-muted-foreground mt-2 text-[12px]">
              Based on your interactions &amp; interests
            </p>
          </div>
        ))}
    </div>
  );
}
