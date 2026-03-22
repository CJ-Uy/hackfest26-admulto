"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/shared/Sidebar";
import { ScrollHeader } from "@/components/shared/ScrollHeader";
import { TabNav } from "@/components/shared/TabNav";
import { SearchBar } from "@/components/shared/SearchBar";
import { FeedView } from "@/components/feed/FeedView";
import { PollsView } from "@/components/polls/PollsView";
import { ExportView } from "@/components/export/ExportView";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { CreatePostFAB } from "@/components/feed/CreatePostFAB";
import { FeedSkeleton } from "@/components/shared/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollCollapse } from "@/hooks/useScrollCollapse";
import { fetchScroll } from "@/lib/scroll-store";
import { cn } from "@/lib/utils";
import type { ScrollSession, Paper, Poll, UserPost } from "@/lib/types";

const TABS = [
  { value: "feed", label: "Feed" },
  { value: "polls", label: "Polls" },
  { value: "export", label: "Export" },
];

export default function ScrollPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const { isCollapsed } = useScrollCollapse(feedScrollRef);
  const [activeTab, setActiveTab] = useState("feed");
  const [scroll, setScroll] = useState<ScrollSession | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [upvotedPapers, setUpvotedPapers] = useState<Set<string>>(new Set());
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);

  const fetchCommentCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments/counts?scrollId=${scrollId}`);
      if (res.ok) {
        const counts: Record<string, number> = await res.json();
        setCommentCounts(new Map(Object.entries(counts)));
      }
    } catch {
      // ignore
    }
  }, [scrollId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;

      if (stored) {
        setScroll(stored.scroll);
        setPapers(stored.papers);
        setPolls(stored.polls || []);
        const voted = new Set<string>();
        stored.papers.forEach((p) => {
          if (p.voted) voted.add(p.id);
        });
        setUpvotedPapers(voted);
      }
    }

    load();
    fetchCommentCounts();
    return () => {
      cancelled = true;
    };
  }, [scrollId, fetchCommentCounts]);

  // Poll for completion if scroll is still generating
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!scroll || scroll.status !== "generating") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    async function pollStatus() {
      try {
        const res = await fetch(`/api/scrolls/${scrollId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        if (data.status === "complete") {
          // Re-fetch full scroll data
          const stored = await fetchScroll(scrollId);
          if (stored) {
            setScroll(stored.scroll);
            setPapers(stored.papers);
            setPolls(stored.polls || []);
            const voted = new Set<string>();
            stored.papers.forEach((p) => {
              if (p.voted) voted.add(p.id);
            });
            setUpvotedPapers(voted);
          }
        }
      } catch {
        // ignore
      }
    }

    pollingRef.current = setInterval(pollStatus, 3000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [scroll, scrollId]);

  // Refresh comment counts when page regains visibility or focus (e.g. coming back from detail page)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchCommentCounts();
      }
    }
    function handleFocus() {
      fetchCommentCounts();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchCommentCounts]);

  const handleUpvote = useCallback((paperId: string, voted: boolean) => {
    setUpvotedPapers((prev) => {
      const next = new Set(prev);
      if (voted) next.add(paperId);
      else next.delete(paperId);
      return next;
    });
  }, []);

  const handleBookmark = useCallback((paperId: string, bookmarked: boolean) => {
    setBookmarkedPapers((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(paperId);
      else next.delete(paperId);
      return next;
    });
  }, []);

  const handleComment = useCallback((paperId: string) => {
    setCommentCounts((prev) => {
      const next = new Map(prev);
      next.set(paperId, (next.get(paperId) || 0) + 1);
      return next;
    });
  }, []);

  const handleNewPost = useCallback((post: UserPost) => {
    setUserPosts((prev) => [post, ...prev]);
  }, []);

  if (!scroll) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#dae0e6]">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 justify-center gap-0 overflow-hidden lg:gap-6 lg:px-6 lg:py-4">
          <main className="bg-background flex min-h-0 w-full max-w-[780px] min-w-0 flex-1 flex-col lg:rounded-t-lg">
            <div className="border-border shrink-0 border-b px-4 pt-5 pb-3">
              <Skeleton className="mb-2 h-5 w-24" />
              <Skeleton className="mb-2 h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="border-border flex shrink-0 border-b">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-1 justify-center py-3">
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto pt-4">
              <FeedSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#dae0e6]">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 justify-center gap-0 overflow-hidden lg:gap-6 lg:px-6 lg:py-4">
        {/* Main content column */}
        <main className="bg-background flex min-h-0 w-full max-w-[780px] min-w-0 flex-1 flex-col lg:rounded-t-lg">
          {/* Sticky top section: search + header + tabs */}
          <div className="bg-background border-border z-30 shrink-0 border-b">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isCollapsed ? "max-h-0 opacity-0" : "max-h-40 opacity-100",
              )}
            >
              <ScrollHeader scroll={scroll} />
            </div>
            <TabNav
              value={activeTab}
              onValueChange={setActiveTab}
              tabs={TABS}
            />
          </div>

          {/* Tab content — independently scrollable */}
          <div ref={feedScrollRef} className="flex-1 overflow-y-auto pb-20">
            {scroll.status === "generating" && (
              <div className="flex flex-col items-center justify-center px-4 py-16">
                <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
                <p className="text-muted-foreground text-sm">
                  Your feed is still being generated. This page will update
                  automatically.
                </p>
              </div>
            )}
            {scroll.status !== "generating" && activeTab === "feed" && (
              <FeedView
                scrollId={scrollId}
                papers={papers}
                polls={polls}
                searchQuery={searchQuery}
                scrollTitle={scroll.title}
                userPosts={userPosts}
                commentCounts={commentCounts}
                bookmarkedPapers={bookmarkedPapers}
                onUpvote={handleUpvote}
                onBookmark={handleBookmark}
                onComment={handleComment}
              />
            )}
            {scroll.status !== "generating" && activeTab === "polls" && (
              <PollsView polls={polls} />
            )}
            {scroll.status !== "generating" && activeTab === "export" && (
              <ExportView scrollId={scrollId} papers={papers} />
            )}
          </div>
        </main>

        {/* Right sidebar */}
        <RightSidebar
          scroll={scroll}
          papers={papers}
          upvotedPapers={upvotedPapers}
          bookmarkedPapers={bookmarkedPapers}
          downvotedPapers={new Set()}
          yourCommentCounts={commentCounts}
          userPosts={userPosts}
          scrollId={scrollId}
        />
      </div>

      <CreatePostFAB scrollId={scrollId} onPost={handleNewPost} />
    </div>
  );
}
