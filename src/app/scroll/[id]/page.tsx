"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/shared/Sidebar";
import { ScrollHeader } from "@/components/shared/ScrollHeader";
import { TabNav } from "@/components/shared/TabNav";
import { SearchBar } from "@/components/shared/SearchBar";
import { FeedView } from "@/components/feed/FeedView";
import { FineTuneView } from "@/components/fine-tune/FineTuneView";
import { ExportView } from "@/components/export/ExportView";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { CreatePostFAB } from "@/components/feed/CreatePostFAB";
import { FeedSkeleton } from "@/components/shared/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollCollapse } from "@/hooks/useScrollCollapse";
import { useScrollStream } from "@/hooks/useScrollStream";
import { useCommentStream } from "@/hooks/useCommentStream";
import { fetchScroll } from "@/lib/scroll-store";
import { cn } from "@/lib/utils";
import type { ScrollSession, Paper, Poll, UserPost, Comment } from "@/lib/types";

const TABS = [
  { value: "feed", label: "Feed" },
  { value: "fine-tune", label: "Fine Tune" },
  { value: "export", label: "Export" },
];

export default function ScrollPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const { isCollapsed } = useScrollCollapse();
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
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [generateMoreProgress, setGenerateMoreProgress] = useState<{
    step: string;
    papersProcessed?: number;
    total?: number;
  } | null>(null);

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
        setUserPosts(stored.userPosts || []);
        const voted = new Set<string>();
        const saved = new Set<string>();
        stored.papers.forEach((p) => {
          if (p.voted) voted.add(p.id);
          if (p.bookmarked) saved.add(p.id);
        });
        setUpvotedPapers(voted);
        setBookmarkedPapers(saved);
      }
    }

    load();
    fetchCommentCounts();
    return () => {
      cancelled = true;
    };
  }, [scrollId, fetchCommentCounts]);

  // Helper to reload full scroll data from the API
  const reloadScroll = useCallback(async () => {
    const stored = await fetchScroll(scrollId);
    if (stored) {
      setScroll(stored.scroll);
      setPapers(stored.papers);
      setPolls(stored.polls || []);
      setUserPosts(stored.userPosts || []);
      const voted = new Set<string>();
      const saved = new Set<string>();
      stored.papers.forEach((p) => {
        if (p.voted) voted.add(p.id);
        if (p.bookmarked) saved.add(p.id);
      });
      setUpvotedPapers(voted);
      setBookmarkedPapers(saved);
    }
    fetchCommentCounts();
  }, [scrollId, fetchCommentCounts]);

  // Live SSE stream for initial feed generation
  useScrollStream({
    scrollId,
    enabled: scroll?.status === "generating" && !isGeneratingMore,
    onComplete: reloadScroll,
  });

  // Live comment stream — update comment counts on feed cards in real-time
  useCommentStream({
    scrollId,
    onComment: useCallback((comment: Comment) => {
      // Increment comment count for the relevant paper/post
      const key = comment.userPostId
        ? `post:${comment.userPostId}`
        : comment.paperId;
      setCommentCounts((prev) => {
        const next = new Map(prev);
        next.set(key, (next.get(key) || 0) + 1);
        return next;
      });
    }, []),
  });

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

  // Live SSE stream for generate-more
  useScrollStream({
    scrollId,
    enabled: isGeneratingMore,
    onProgress: (progress) => {
      setGenerateMoreProgress(progress);
    },
    onComplete: async () => {
      await reloadScroll();
      setIsGeneratingMore(false);
      setGenerateMoreProgress(null);
    },
    onError: () => {
      setIsGeneratingMore(false);
      setGenerateMoreProgress(null);
    },
  });

  // Generate More handler
  const handleGenerateMore = useCallback(async () => {
    setIsGeneratingMore(true);
    setGenerateMoreProgress({ step: "searching" });

    try {
      await fetch("/api/generate-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollId }),
      });
    } catch {
      setIsGeneratingMore(false);
      setGenerateMoreProgress(null);
    }
  }, [scrollId]);

  if (!scroll) {
    return (
      <div className="flex min-h-screen bg-[#dae0e6]">
        <Sidebar />
        <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
          <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
            <div className="border-border border-b px-4 pt-5 pb-3">
              <Skeleton className="mb-2 h-5 w-24" />
              <Skeleton className="mb-2 h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="border-border flex border-b">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-1 justify-center py-3">
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
            <div className="pt-4">
              <FeedSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#dae0e6]">
      <Sidebar />

      <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        {/* Main content column */}
        <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
          {/* Sticky top section: search + header + tabs */}
          <div className="bg-background border-border sticky top-0 z-30 border-b">
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

          {/* Tab content */}
          <div className="overflow-hidden pb-20">
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
                isGeneratingMore={isGeneratingMore}
                generateMoreProgress={generateMoreProgress}
                onUpvote={handleUpvote}
                onBookmark={handleBookmark}
                onComment={handleComment}
                onGenerateMore={handleGenerateMore}
                onPost={handleNewPost}
              />
            )}
            {scroll.status !== "generating" && activeTab === "fine-tune" && (
              <FineTuneView
                scrollId={scrollId}
                onRegenerated={async () => {
                  const stored = await fetchScroll(scrollId);
                  if (stored) {
                    setScroll(stored.scroll);
                    setPapers(stored.papers);
                    setPolls(stored.polls || []);
                    setUserPosts(stored.userPosts || []);
                    const voted = new Set<string>();
                    const saved = new Set<string>();
                    stored.papers.forEach((p) => {
                      if (p.voted) voted.add(p.id);
                      if (p.bookmarked) saved.add(p.id);
                    });
                    setUpvotedPapers(voted);
                    setBookmarkedPapers(saved);
                  }
                  fetchCommentCounts();
                  setActiveTab("feed");
                }}
              />
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
          commentCounts={commentCounts}
          userPosts={userPosts}
          scrollId={scrollId}
        />
      </div>

      <CreatePostFAB scrollId={scrollId} onPost={handleNewPost} />
    </div>
  );
}
