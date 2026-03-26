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
import { SidebarBrandCard } from "@/components/shared/SidebarBrandCard";
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
  showMobileTrigger?: boolean;
  contentOnly?: boolean;
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
  showMobileTrigger = true,
  contentOnly = false,
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
  const hasMobileInsightsActivity =
    bookmarkedList.length > 0 ||
    upvotedPapers.size > 0 ||
    downvotedPapers.size > 0 ||
    safeYourCommentCounts.size > 0;

  const sidebarContent = (
    <div>
      {/* Brand card */}
      <SidebarBrandCard />

      <hr className="border-border" />

      {/* Session header */}
      <div className="pt-3 pb-3">
        <div className="bg-primary rounded-lg px-4 py-3 mb-3">
          <h3 className="text-primary-foreground text-[15px] font-bold">
            {scroll.title}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat
            icon={<FileText className="h-4 w-4" />}
            label="Papers"
            value={scroll.paperCount}
          />
          <Stat
            icon={<ArrowBigUp className="h-4 w-4" />}
            label="Avg Score"
            value={avgScore}
          />
          <Stat
            icon={<ArrowBigUp className="h-4 w-4" />}
            label="Upvoted"
            value={upvotedPapers.size}
          />
          <Stat
            icon={<MessageSquare className="h-4 w-4" />}
            label="Citations"
            value={
              totalCitations >= 1000
                ? `${(totalCitations / 1000).toFixed(0)}k`
                : totalCitations
            }
          />
        </div>
        <div className="mt-2.5">
          <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-semibold">
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

      <hr className="border-border" />

      {/* Your Posts */}
      <SidebarSection
        icon={<PenLine className="text-primary h-4 w-4" />}
        title="Your Posts"
        emptyText="No posts yet. Use the compose box or + button."
      >
        {userPosts.length > 0 && (
          <div className="space-y-1">
            {userPosts.slice(0, 5).map((post) => (
              <Link
                key={post.id}
                href={`/schroll/${scrollId}/userpost/${post.id}`}
                className="hover:bg-subtle block rounded-md p-2 transition-colors"
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

      <hr className="border-border" />

      {/* Uploaded Files */}
      {scroll.pdfKeys && scroll.pdfKeys.length > 0 && (
        <>
          <SidebarSection
            icon={<FileUp className="text-primary h-4 w-4" />}
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
                    className="hover:bg-subtle flex items-center gap-2 rounded-md p-2 transition-colors"
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
          <hr className="border-border" />
        </>
      )}

      {/* Saved (Bookmarked) */}
      <SidebarSection
        icon={<Bookmark className="text-primary h-4 w-4" />}
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

      <hr className="border-border" />

      {/* Upvoted / Downvoted (tabbed) */}
      <div className="py-3">
        <div className="mb-2.5 flex items-center gap-3">
          <button
            onClick={() => setVoteTab("upvoted")}
            className={`flex items-center gap-1.5 text-[12px] font-bold tracking-widest uppercase transition-colors ${
              voteTab === "upvoted"
                ? "text-[#ff4500]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowBigUp className="h-4 w-4" />
            Upvoted ({upvotedList.length})
          </button>
          <button
            onClick={() => setVoteTab("downvoted")}
            className={`flex items-center gap-1.5 text-[12px] font-bold tracking-widest uppercase transition-colors ${
              voteTab === "downvoted"
                ? "text-[#7193ff]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowBigDown className="h-4 w-4" />
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

      <hr className="border-border" />

      {/* Comments activity */}
      <SidebarSection
        icon={<MessageSquare className="text-primary h-4 w-4" />}
        title="Your Comments"
        emptyText="Click on a paper to leave comments."
      >
        {safeYourCommentCounts.size > 0 && (
          <div className="space-y-1">
            {Array.from(safeYourCommentCounts.entries()).map(
              ([paperId, count]) => {
                const paper = papers.find((p) => p.id === paperId);
                if (!paper) return null;
                return (
                  <Link
                    key={paperId}
                    href={`/schroll/${scrollId}/post/${paperId}`}
                    className="hover:bg-subtle block rounded-md p-2 transition-colors"
                  >
                    <p className="text-foreground line-clamp-1 text-[14px] font-medium">
                      {paper.title}
                    </p>
                    <p className="text-muted-foreground text-[13px]">
                      {count} {count === 1 ? "comment" : "comments"}
                    </p>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </SidebarSection>
    </div>
  );

  if (contentOnly) {
    return sidebarContent;
  }

  return (
    <>
      {/* Mobile trigger - floating insights button */}
      {showMobileTrigger && (
        <div className="fixed bottom-6 left-6 z-50 lg:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="border-border bg-background/95 hover:bg-background relative h-11 rounded-full px-4 shadow-lg backdrop-blur"
                />
              }
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Insights
              {hasMobileInsightsActivity && (
                <span className="bg-primary absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full" />
              )}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-[80vh] overflow-y-auto rounded-t-2xl p-4"
            >
              <SheetTitle className="sr-only">Session info</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-scrollbar hidden w-[312px] shrink-0 px-3 lg:sticky lg:top-12 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
        {sidebarContent}
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
    <div className="bg-subtle rounded-md p-2.5">
      <div className="text-muted-foreground mb-0.5 flex items-center gap-1.5">
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
    <div className="py-3">
      <h3 className="text-foreground mb-2.5 flex items-center gap-1.5 text-[12px] font-bold tracking-widest uppercase">
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
          className="hover:bg-subtle block rounded-md p-2 transition-colors"
        >
          <p className="text-foreground line-clamp-2 text-[14px] leading-snug font-bold">
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
