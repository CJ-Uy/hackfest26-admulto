"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { toast } from "sonner";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Navbar } from "@/components/shared/Navbar";
import { ScrollHeader } from "@/components/shared/ScrollHeader";
import { TabNav } from "@/components/shared/TabNav";
import { FeedView } from "@/components/feed/FeedView";
import { FineTuneView } from "@/components/fine-tune/FineTuneView";
import { ExportView } from "@/components/export/ExportView";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { CreatePostFAB } from "@/components/feed/CreatePostFAB";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
import {
  FeedSkeleton,
  RightSidebarSkeleton,
} from "@/components/shared/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

import { useScrollStream, type ScrollProgress } from "@/hooks/useScrollStream";
import { useCommentStream } from "@/hooks/useCommentStream";
import { fetchScroll } from "@/lib/scroll-store";
import { GenerationProgress } from "@/components/onboarding/GenerationProgress";

import type {
  ScrollSession,
  Paper,
  Poll,
  UserPost,
  Comment,
} from "@/lib/types";

const TABS = [
  { value: "feed", label: "Feed" },
  { value: "fine-tune", label: "Fine Tune" },
  { value: "export", label: "Export" },
];

function ScrollPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const scrollId = params.id as string;

  const [activeTab, setActiveTab] = useState("feed");
  const [scroll, setScroll] = useState<ScrollSession | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );
  const [upvotedPapers, setUpvotedPapers] = useState<Set<string>>(new Set());
  const [downvotedPapers, setDownvotedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [yourCommentCounts, setYourCommentCounts] = useState<
    Map<string, number>
  >(new Map());
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  // Track papers/posts that have replies to YOUR comments (different marker)
  const [replyNotifIds, setReplyNotifIds] = useState<Set<string>>(new Set());
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [generateMoreProgress, setGenerateMoreProgress] = useState<{
    step: string;
    papersProcessed?: number;
    total?: number;
  } | null>(null);
  const [generatingProgress, setGeneratingProgress] = useState<{
    step: string;
    papersProcessed?: number;
    total?: number;
    message?: string;
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

  const fetchYourCommentCounts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments/counts?scrollId=${scrollId}&onlyMine=true`,
      );
      if (res.ok) {
        const counts: Record<string, number> = await res.json();
        setYourCommentCounts(new Map(Object.entries(counts)));
      }
    } catch {
      // ignore
    }
  }, [scrollId]);

  // Seed comments for papers that have none (best-effort, one-at-a-time)
  const seedingRef = useRef(false);
  const seedComments = useCallback(
    async (paperList: Paper[]) => {
      if (seedingRef.current) return;
      const needsComments = paperList.filter((p) => p.commentCount === 0);
      if (needsComments.length === 0) return;
      seedingRef.current = true;
      for (const paper of needsComments) {
        try {
          await fetch(`/api/scrolls/${scrollId}/generate-comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paperId: paper.id }),
          });
        } catch {
          // best-effort
        }
      }
      fetchCommentCounts();
      seedingRef.current = false;
    },
    [scrollId, fetchCommentCounts],
  );

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
        const downed = new Set<string>();
        const saved = new Set<string>();
        stored.papers.forEach((p) => {
          if (p.voted) voted.add(p.id);
          if (p.downvoted) downed.add(p.id);
          if (p.bookmarked) saved.add(p.id);
        });
        setUpvotedPapers(voted);
        setDownvotedPapers(downed);
        setBookmarkedPapers(saved);

        // Seed comments for papers with none
        seedComments(stored.papers);
      }
    }

    load();
    fetchCommentCounts();
    fetchYourCommentCounts();
    return () => {
      cancelled = true;
    };
  }, [scrollId, fetchCommentCounts, fetchYourCommentCounts, seedComments]);

  // Helper to reload full scroll data from the API
  const reloadScroll = useCallback(async () => {
    const stored = await fetchScroll(scrollId);
    if (stored) {
      setScroll(stored.scroll);
      setPapers(stored.papers);
      setPolls(stored.polls || []);
      setUserPosts(stored.userPosts || []);
      const voted = new Set<string>();
      const downed = new Set<string>();
      const saved = new Set<string>();
      stored.papers.forEach((p) => {
        if (p.voted) voted.add(p.id);
        if (p.downvoted) downed.add(p.id);
        if (p.bookmarked) saved.add(p.id);
      });
      setUpvotedPapers(voted);
      setDownvotedPapers(downed);
      setBookmarkedPapers(saved);
    }
    fetchCommentCounts();
    fetchYourCommentCounts();
  }, [scrollId, fetchCommentCounts, fetchYourCommentCounts]);

  // Live SSE stream for initial feed generation
  useScrollStream({
    scrollId,
    enabled: scroll?.status === "generating" && !isGeneratingMore,
    onProgress: useCallback((p: ScrollProgress) => setGeneratingProgress(p), []),
    onComplete: reloadScroll,
    onError: useCallback(() => {
      toast.error("Connection lost. Refreshing...");
      reloadScroll();
    }, [reloadScroll]),
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

      // Track only user-authored comments for the right sidebar section.
      if (!comment.isGenerated && comment.author === "You") {
        setYourCommentCounts((prev) => {
          const next = new Map(prev);
          next.set(key, (next.get(key) || 0) + 1);
          return next;
        });
      }

      // Track new comments for notification dots
      const notifKey = comment.userPostId
        ? `post:${comment.userPostId}`
        : comment.paperId;
      setNewCommentIds((prev) => new Set(prev).add(notifKey));

      // If this is an AI reply to one of the user's comments, add reply notification
      if (comment.isGenerated && comment.parentId) {
        setReplyNotifIds((prev) => new Set(prev).add(notifKey));
      }

      // Clear generating indicator when AI replies to a user post
      if (comment.userPostId && comment.isGenerated) {
        setGeneratingPostIds((prev) => {
          if (!prev.has(comment.userPostId!)) return prev;
          const next = new Set(prev);
          next.delete(comment.userPostId!);
          return next;
        });
      }
    }, []),
  });

  // Generate comments for a specific paper on demand
  const handleGenerateComments = useCallback(
    async (paperId: string) => {
      try {
        await fetch(`/api/scrolls/${scrollId}/generate-comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId }),
        });
      } catch {
        // ignore
      }
    },
    [scrollId],
  );

  // Refresh comment counts when page regains visibility or focus (e.g. coming back from detail page)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchCommentCounts();
        fetchYourCommentCounts();
      }
    }
    function handleFocus() {
      fetchCommentCounts();
      fetchYourCommentCounts();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchCommentCounts, fetchYourCommentCounts]);

  const handleUpvote = useCallback((paperId: string, voted: boolean) => {
    setUpvotedPapers((prev) => {
      const next = new Set(prev);
      if (voted) next.add(paperId);
      else next.delete(paperId);
      return next;
    });
  }, []);

  const handleDownvote = useCallback(
    (paperId: string, isDownvoted: boolean) => {
      setDownvotedPapers((prev) => {
        const next = new Set(prev);
        if (isDownvoted) next.add(paperId);
        else next.delete(paperId);
        return next;
      });
    },
    [],
  );

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

    setYourCommentCounts((prev) => {
      const next = new Map(prev);
      next.set(paperId, (next.get(paperId) || 0) + 1);
      return next;
    });
  }, []);

  const handleNewPost = useCallback((post: UserPost) => {
    setUserPosts((prev) => [post, ...prev]);
    // Mark post as generating (AI will reply)
    setGeneratingPostIds((prev) => new Set(prev).add(post.id));
    // Auto-clear after 90s as safety timeout
    setTimeout(() => {
      setGeneratingPostIds((prev) => {
        if (!prev.has(post.id)) return prev;
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }, 90000);
  }, []);

  const handleDeletePaper = useCallback(async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers/${paperId}`, { method: "DELETE" });
      if (res.ok) {
        setPapers((prev) => prev.filter((p) => p.id !== paperId));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`/api/user-posts?id=${postId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUserPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      // ignore
    }
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
    setGenerateMoreProgress({ step: "searching" });

    try {
      const res = await fetch("/api/generate-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrollId }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      // Start polling only AFTER the DB has been set to "generating"
      setIsGeneratingMore(true);
    } catch {
      setGenerateMoreProgress(null);
      toast.error("Failed to generate more papers");
    }
  }, [scrollId]);

  if (!scroll) {
    return (
      <div className="bg-page-bg min-h-screen">
        <Navbar />
        <Navbar
          showMobile
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search this feed"
        />
        <div className="flex">
          <Sidebar showMobileTrigger={false} />
          <div className="flex min-w-0 flex-1 justify-center">
            <main className="w-full max-w-215 min-w-0 flex-1">
              <div className="px-4 pt-4 pb-3">
                <div className="mb-2 flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="mb-2 h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>

              <div className="bg-background border-border sticky top-14 z-30 border-b md:top-12">
                <div className="flex">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-1 justify-center py-3">
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <FeedSkeleton />
              </div>
            </main>

            <RightSidebarSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-page-bg min-h-screen">
      <Navbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search this feed"
      />
      <Navbar
        showMobile
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search this feed"
      />

      <div className="flex">
        <Sidebar showMobileTrigger={false} />

        <div className="flex min-w-0 flex-1 justify-center">
          {/* Main content column */}
          <main className="border-border w-full max-w-215 min-w-0 flex-1 border-x">
            <ScrollHeader scroll={scroll} />

            {/* Mobile: tabs sticky below mobile navbar */}
            <div className="bg-background border-border sticky top-14 z-30 border-b md:hidden">
              <TabNav
                value={activeTab}
                onValueChange={setActiveTab}
                tabs={TABS}
              />
            </div>

            {/* Desktop: tabs sticky below navbar */}
            <div className="bg-background border-border sticky top-12 z-30 hidden border-b md:block">
              <TabNav
                value={activeTab}
                onValueChange={setActiveTab}
                tabs={TABS}
              />
            </div>

            {/* Tab content */}
            <div className="overflow-hidden pb-20">
              {scroll.status === "generating" && (
                <div className="px-5 pb-8">
                  <GenerationProgress
                    progress={generatingProgress}
                    topic={scroll.title}
                    hasPdfs={scroll.mode === "pdf_only" || scroll.mode === "pdf_include" || scroll.mode === "pdf_context"}
                  />
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
                  downvotedPapers={downvotedPapers}
                  isGeneratingMore={isGeneratingMore}
                  generateMoreProgress={generateMoreProgress}
                  onUpvote={handleUpvote}
                  onDownvote={handleDownvote}
                  onBookmark={handleBookmark}
                  onComment={handleComment}
                  onGenerateMore={handleGenerateMore}
                  onPost={handleNewPost}
                  onGenerateComments={handleGenerateComments}
                  onDelete={handleDeletePaper}
                  onDeletePost={handleDeletePost}
                  generatingPostIds={generatingPostIds}
                  newCommentIds={newCommentIds}
                  replyNotifIds={replyNotifIds}
                  onClearNewComment={(id: string) => {
                    setNewCommentIds((prev) => {
                      if (!prev.has(id)) return prev;
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    });
                    setReplyNotifIds((prev) => {
                      if (!prev.has(id)) return prev;
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    });
                  }}
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
                      const downed = new Set<string>();
                      const saved = new Set<string>();
                      stored.papers.forEach((p) => {
                        if (p.voted) voted.add(p.id);
                        if (p.downvoted) downed.add(p.id);
                        if (p.bookmarked) saved.add(p.id);
                      });
                      setUpvotedPapers(voted);
                      setDownvotedPapers(downed);
                      setBookmarkedPapers(saved);
                    }
                    fetchCommentCounts();
                    fetchYourCommentCounts();
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
            downvotedPapers={downvotedPapers}
            bookmarkedPapers={bookmarkedPapers}
            yourCommentCounts={yourCommentCounts}
            userPosts={userPosts}
            scrollId={scrollId}
            showMobileTrigger={false}
          />
        </div>
      </div>

      <div className="hidden md:block">
        <CreatePostFAB scrollId={scrollId} onPost={handleNewPost} />
      </div>
      <MobileBottomNav
        scrollId={scrollId}
        onPost={handleNewPost}
        scroll={scroll}
        papers={papers}
        upvotedPapers={upvotedPapers}
        downvotedPapers={downvotedPapers}
        bookmarkedPapers={bookmarkedPapers}
        yourCommentCounts={yourCommentCounts}
        userPosts={userPosts}
      />
    </div>
  );
}

export default function ScrollPage() {
  return (
    <Suspense>
      <ScrollPageInner />
    </Suspense>
  );
}
