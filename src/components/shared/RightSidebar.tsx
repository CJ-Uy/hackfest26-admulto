"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigUp,
  MessageSquare,
  FileText,
  Bookmark,
  ChevronDown,
  User,
  PenLine,
} from "lucide-react";
import type { ScrollSession, Paper, UserPost } from "@/lib/types";

interface RightSidebarProps {
  scroll: ScrollSession;
  papers: Paper[];
  upvotedPapers: Set<string>;
  bookmarkedPapers: Set<string>;
  commentCounts: Map<string, number>;
  userPosts: UserPost[];
  scrollId: string;
}

export function RightSidebar({
  scroll,
  papers,
  upvotedPapers,
  bookmarkedPapers,
  commentCounts,
  userPosts,
  scrollId,
}: RightSidebarProps) {
  const [showAllUpvoted, setShowAllUpvoted] = useState(false);
  const [showAllBookmarked, setShowAllBookmarked] = useState(false);

  const upvotedList = papers.filter((p) => upvotedPapers.has(p.id));
  const bookmarkedList = papers.filter((p) => bookmarkedPapers.has(p.id));
  const displayUpvoted = showAllUpvoted ? upvotedList : upvotedList.slice(0, 3);
  const displayBookmarked = showAllBookmarked
    ? bookmarkedList
    : bookmarkedList.slice(0, 3);

  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);
  const avgScore = papers.length
    ? Math.round(
        papers.reduce((sum, p) => sum + p.credibilityScore, 0) / papers.length,
      )
    : 0;

  return (
    <aside className="hidden w-[340px] shrink-0 lg:block">
      <div className="sticky top-0 h-screen space-y-3 overflow-y-auto py-4">
        {/* Session stats */}
        <div className="border-border bg-background rounded-lg border p-3.5">
          <div className="bg-primary mb-3 rounded-md px-3 py-2.5">
            <h3 className="text-primary-foreground text-[15px] font-bold">
              {scroll.title}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Papers"
              value={scroll.paperCount}
            />
            <Stat
              icon={<ArrowBigUp className="h-3.5 w-3.5" />}
              label="Avg Score"
              value={avgScore}
            />
            <Stat
              icon={<ArrowBigUp className="h-3.5 w-3.5" />}
              label="Upvoted"
              value={upvotedPapers.size}
            />
            <Stat
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Citations"
              value={
                totalCitations >= 1000
                  ? `${(totalCitations / 1000).toFixed(0)}k`
                  : totalCitations
              }
            />
          </div>
          <div className="border-border mt-2 border-t pt-2">
            <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold">
              {scroll.mode === "brainstorm" ? "Brainstorm" : "Citation Finder"}
            </span>
          </div>
        </div>

        {/* Your Posts */}
        <SidebarSection
          icon={<PenLine className="text-primary h-3.5 w-3.5" />}
          title="Your Posts"
          emptyText="No posts yet. Use the compose box or + button."
        >
          {userPosts.length > 0 && (
            <div className="space-y-1">
              {userPosts.slice(0, 5).map((post) => (
                <Link
                  key={post.id}
                  href={`/scroll/${scrollId}/userpost/${post.id}`}
                  className="block rounded-md p-2 transition-colors hover:bg-[#f6f7f8]"
                >
                  {post.title && (
                    <p className="text-foreground line-clamp-1 text-[14px] font-semibold">
                      {post.title}
                    </p>
                  )}
                  <p className="text-muted-foreground line-clamp-2 text-[14px]">
                    {post.content}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SidebarSection>

        {/* Upvoted */}
        <SidebarSection
          icon={<ArrowBigUp className="h-3.5 w-3.5 text-[#ff4500]" />}
          title="Upvoted"
          emptyText="Upvote papers to save them here."
        >
          {upvotedList.length > 0 && (
            <>
              <PaperList papers={displayUpvoted} scrollId={scrollId} />
              {upvotedList.length > 3 && !showAllUpvoted && (
                <ShowMore
                  count={upvotedList.length - 3}
                  onClick={() => setShowAllUpvoted(true)}
                />
              )}
            </>
          )}
        </SidebarSection>

        {/* Bookmarked */}
        <SidebarSection
          icon={<Bookmark className="text-primary h-3.5 w-3.5" />}
          title="Saved"
          emptyText="Bookmark papers to save them here."
        >
          {bookmarkedList.length > 0 && (
            <>
              <PaperList papers={displayBookmarked} scrollId={scrollId} />
              {bookmarkedList.length > 3 && !showAllBookmarked && (
                <ShowMore
                  count={bookmarkedList.length - 3}
                  onClick={() => setShowAllBookmarked(true)}
                />
              )}
            </>
          )}
        </SidebarSection>

        {/* Comments activity */}
        <SidebarSection
          icon={<MessageSquare className="text-primary h-3.5 w-3.5" />}
          title="Your Comments"
          emptyText="Click on a paper to leave comments."
        >
          {commentCounts.size > 0 && (
            <div className="space-y-1">
              {Array.from(commentCounts.entries()).map(([paperId, count]) => {
                const paper = papers.find((p) => p.id === paperId);
                if (!paper) return null;
                return (
                  <Link
                    key={paperId}
                    href={`/scroll/${scrollId}/post/${paperId}`}
                    className="block rounded-md p-2 transition-colors hover:bg-[#f6f7f8]"
                  >
                    <p className="text-foreground line-clamp-1 text-[14px] font-medium">
                      {paper.title}
                    </p>
                    <p className="text-muted-foreground text-[13px]">
                      {count} {count === 1 ? "comment" : "comments"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </SidebarSection>
      </div>
    </aside>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md bg-[#f6f7f8] p-2.5">
      <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}
        <span className="text-[13px]">{label}</span>
      </div>
      <p className="text-foreground text-[18px] font-bold">{value}</p>
    </div>
  );
}

function SidebarSection({
  icon,
  title,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren =
    children !== undefined && children !== null && children !== false;
  return (
    <div className="border-border bg-background rounded-lg border p-3.5">
      <h3 className="text-foreground mb-2.5 flex items-center gap-1.5 text-[13px] font-bold tracking-wide uppercase">
        {icon} {title}
      </h3>
      {hasChildren ? (
        children
      ) : (
        <p className="text-muted-foreground text-[14px]">{emptyText}</p>
      )}
    </div>
  );
}

function PaperList({
  papers,
  scrollId,
}: {
  papers: Paper[];
  scrollId: string;
}) {
  return (
    <div className="space-y-1">
      {papers.map((paper) => (
        <Link
          key={paper.id}
          href={`/scroll/${scrollId}/post/${paper.id}`}
          className="block rounded-md p-2 transition-colors hover:bg-[#f6f7f8]"
        >
          <p className="text-foreground line-clamp-2 text-[14px] leading-snug font-medium">
            {paper.title}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            {paper.authors[0] || "Unknown"} &middot; {paper.year}
          </p>
        </Link>
      ))}
    </div>
  );
}

function ShowMore({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-primary mt-1 flex items-center gap-1 text-[14px] font-semibold hover:underline"
    >
      Show {count} more <ChevronDown className="h-3 w-3" />
    </button>
  );
}
