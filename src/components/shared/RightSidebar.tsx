"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowBigUp, MessageSquare, FileText, Bookmark, ChevronDown, User, PenLine } from "lucide-react";
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
  const displayBookmarked = showAllBookmarked ? bookmarkedList : bookmarkedList.slice(0, 3);

  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);
  const avgScore = papers.length
    ? Math.round(papers.reduce((sum, p) => sum + p.credibilityScore, 0) / papers.length)
    : 0;

  return (
    <aside className="hidden w-[340px] shrink-0 lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto py-4 space-y-3">

        {/* Session stats */}
        <div className="rounded-lg border border-border bg-background p-3.5">
          <div className="rounded-md bg-primary px-3 py-2.5 mb-3">
            <h3 className="text-[15px] font-bold text-primary-foreground">{scroll.title}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<FileText className="h-3.5 w-3.5" />} label="Papers" value={scroll.paperCount} />
            <Stat icon={<ArrowBigUp className="h-3.5 w-3.5" />} label="Avg Score" value={avgScore} />
            <Stat icon={<ArrowBigUp className="h-3.5 w-3.5" />} label="Upvoted" value={upvotedPapers.size} />
            <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Citations" value={totalCitations >= 1000 ? `${(totalCitations / 1000).toFixed(0)}k` : totalCitations} />
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[13px] font-semibold text-primary">
              {scroll.mode === "brainstorm" ? "Brainstorm" : "Citation Finder"}
            </span>
          </div>
        </div>

        {/* Your Posts */}
        <SidebarSection
          icon={<PenLine className="h-3.5 w-3.5 text-primary" />}
          title="Your Posts"
          emptyText="No posts yet. Use the compose box or + button."
        >
          {userPosts.length > 0 && (
            <div className="space-y-1">
              {userPosts.slice(0, 5).map((post) => (
                <div key={post.id} className="rounded-md p-2 hover:bg-[#f6f7f8] transition-colors">
                  {post.title && (
                    <p className="text-[14px] font-semibold text-foreground line-clamp-1">{post.title}</p>
                  )}
                  <p className="text-[14px] text-muted-foreground line-clamp-2">{post.content}</p>
                </div>
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
                <ShowMore count={upvotedList.length - 3} onClick={() => setShowAllUpvoted(true)} />
              )}
            </>
          )}
        </SidebarSection>

        {/* Bookmarked */}
        <SidebarSection
          icon={<Bookmark className="h-3.5 w-3.5 text-primary" />}
          title="Saved"
          emptyText="Bookmark papers to save them here."
        >
          {bookmarkedList.length > 0 && (
            <>
              <PaperList papers={displayBookmarked} scrollId={scrollId} />
              {bookmarkedList.length > 3 && !showAllBookmarked && (
                <ShowMore count={bookmarkedList.length - 3} onClick={() => setShowAllBookmarked(true)} />
              )}
            </>
          )}
        </SidebarSection>

        {/* Comments activity */}
        <SidebarSection
          icon={<MessageSquare className="h-3.5 w-3.5 text-primary" />}
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
                    <p className="text-[14px] font-medium text-foreground line-clamp-1">{paper.title}</p>
                    <p className="text-[13px] text-muted-foreground">{count} {count === 1 ? "comment" : "comments"}</p>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-[#f6f7f8] p-2.5">
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[13px]">{label}</span>
      </div>
      <p className="text-[18px] font-bold text-foreground">{value}</p>
    </div>
  );
}

function SidebarSection({ icon, title, emptyText, children }: {
  icon: React.ReactNode;
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren = children !== undefined && children !== null && children !== false;
  return (
    <div className="rounded-lg border border-border bg-background p-3.5">
      <h3 className="text-[13px] font-bold text-foreground mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
        {icon} {title}
      </h3>
      {hasChildren ? children : (
        <p className="text-[14px] text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function PaperList({ papers, scrollId }: { papers: Paper[]; scrollId: string }) {
  return (
    <div className="space-y-1">
      {papers.map((paper) => (
        <Link
          key={paper.id}
          href={`/scroll/${scrollId}/post/${paper.id}`}
          className="block rounded-md p-2 transition-colors hover:bg-[#f6f7f8]"
        >
          <p className="text-[14px] font-medium text-foreground leading-snug line-clamp-2">{paper.title}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">
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
      className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline"
    >
      Show {count} more <ChevronDown className="h-3 w-3" />
    </button>
  );
}
