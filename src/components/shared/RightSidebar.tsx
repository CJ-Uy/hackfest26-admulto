"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  FileText,
  Bookmark,
  ChevronDown,
  PenLine,
  FileUp,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ScrollSession, Paper, UserPost } from "@/lib/types";

interface RightSidebarProps {
  scroll: ScrollSession;
  papers: Paper[];
  upvotedPapers: Set<string>;
  downvotedPapers: Set<string>;
  bookmarkedPapers: Set<string>;
  yourCommentCounts: Map<string, number>;
  userPosts: UserPost[];
  scrollId: string;
}

export function RightSidebar({
  scroll,
  papers,
  upvotedPapers,
  downvotedPapers,
  bookmarkedPapers,
  yourCommentCounts,
  userPosts,
  scrollId,
}: RightSidebarProps) {
  const safeYourCommentCounts = yourCommentCounts ?? new Map<string, number>();
  const [showAllBookmarked, setShowAllBookmarked] = useState(false);
  const [voteTab, setVoteTab] = useState<"upvoted" | "downvoted">("upvoted");

  const upvotedList = papers.filter((p) => upvotedPapers.has(p.id));
  const downvotedList = papers.filter((p) => downvotedPapers.has(p.id));
  const bookmarkedList = papers.filter((p) => bookmarkedPapers.has(p.id));
  const displayBookmarked = showAllBookmarked
    ? bookmarkedList
    : bookmarkedList.slice(0, 3);

  const totalCitations = papers.reduce((sum, p) => sum + p.citationCount, 0);
  const avgScore = papers.length
    ? Math.round(
        papers.reduce((sum, p) => sum + p.credibilityScore, 0) / papers.length,
      )
    : 0;

  const sidebarContent = (
    <div className="space-y-3">
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
            {scroll.mode === "pdf_only"
              ? "PDF Only"
              : scroll.mode === "pdf_context"
                ? "PDF + Research"
                : scroll.mode === "pdf_include"
                  ? "PDF + Research"
                  : scroll.mode === "brainstorm"
                    ? "Brainstorm"
                    : "Research"}
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
                href={`/schroll/${scrollId}/userpost/${post.id}`}
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

      {/* Uploaded Files */}
      {scroll.pdfKeys && scroll.pdfKeys.length > 0 && (
        <SidebarSection
          icon={<FileUp className="text-primary h-3.5 w-3.5" />}
          title="Uploaded Files"
          emptyText=""
        >
          <div className="space-y-1">
            {scroll.pdfKeys.map((key) => {
              const filename = key.split("/").pop() || "document.pdf";
              return (
                <a
                  key={key}
                  href={`/api/pdfs/${encodeURIComponent(key)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-[#f6f7f8]"
                >
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-foreground line-clamp-1 text-[14px]">
                    {filename}
                  </span>
                </a>
              );
            })}
          </div>
        </SidebarSection>
      )}

      {/* Saved (Bookmarked) */}
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

      {/* Upvoted / Downvoted (tabbed) */}
      <div className="border-border bg-background rounded-lg border p-3.5">
        <div className="mb-2.5 flex items-center gap-3">
          <button
            onClick={() => setVoteTab("upvoted")}
            className={`flex items-center gap-1 text-[13px] font-bold tracking-wide uppercase transition-colors ${
              voteTab === "upvoted"
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowBigUp className="h-3.5 w-3.5" />
            Upvoted ({upvotedList.length})
          </button>
          <button
            onClick={() => setVoteTab("downvoted")}
            className={`flex items-center gap-1 text-[13px] font-bold tracking-wide uppercase transition-colors ${
              voteTab === "downvoted"
                ? "text-[#7193ff]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowBigDown className="h-3.5 w-3.5" />
            Downvoted ({downvotedList.length})
          </button>
        </div>
        {voteTab === "upvoted" ? (
          upvotedList.length > 0 ? (
            <PaperList papers={upvotedList} scrollId={scrollId} />
          ) : (
            <p className="text-muted-foreground text-[14px]">
              Upvote papers to save them here.
            </p>
          )
        ) : downvotedList.length > 0 ? (
          <PaperList papers={downvotedList} scrollId={scrollId} />
        ) : (
          <p className="text-muted-foreground text-[14px]">
            No downvoted papers.
          </p>
        )}
      </div>

      {/* Comments activity */}
      <SidebarSection
        icon={<MessageSquare className="text-primary h-3.5 w-3.5" />}
        title="Your Comments"
        emptyText="Click on a paper to leave comments."
      >
        {safeYourCommentCounts.size > 0 && (
          <div className="space-y-1">
            {Array.from(safeYourCommentCounts.entries()).map(([paperId, count]) => {
              const paper = papers.find((p) => p.id === paperId);
              if (!paper) return null;
              return (
                <Link
                  key={paperId}
                  href={`/schroll/${scrollId}/post/${paperId}`}
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
  );

  return (
    <>
      {/* Mobile trigger - fixed bottom-left */}
      <div className="fixed bottom-6 left-6 z-50 lg:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shadow-md"
              />
            }
          >
            <BarChart3 className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[340px] overflow-y-auto p-4">
            <SheetTitle className="sr-only">Session info</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-[340px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto py-4">
          {sidebarContent}
        </div>
      </aside>
    </>
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
          href={`/schroll/${scrollId}/post/${paper.id}`}
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
