"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { ScrollHeader } from "@/components/shared/ScrollHeader";
import { TabNav } from "@/components/shared/TabNav";
import { SearchBar } from "@/components/shared/SearchBar";
import { FeedView } from "@/components/feed/FeedView";
import { PollsView } from "@/components/polls/PollsView";
import { ExportView } from "@/components/export/ExportView";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { CreatePostFAB } from "@/components/feed/CreatePostFAB";
import { fetchScroll } from "@/lib/scroll-store";
import type { ScrollSession, Paper, Poll, UserPost } from "@/lib/types";

const TABS = [
  { value: "feed", label: "Feed" },
  { value: "polls", label: "Polls" },
  { value: "export", label: "Export" },
];

export default function ScrollPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const [activeTab, setActiveTab] = useState("feed");
  const [scroll, setScroll] = useState<ScrollSession | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [headerVisible, setHeaderVisible] = useState(true);
  const [upvotedPapers, setUpvotedPapers] = useState<Set<string>>(new Set());
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);

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
    return () => { cancelled = true; };
  }, [scrollId, fetchCommentCounts]);

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

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroll]);

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

  if (!scroll) return null;

  return (
    <div className="flex min-h-screen bg-[#dae0e6]">
      <Sidebar />

      <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        {/* Main content column */}
        <main className="w-full max-w-[780px] flex-1 bg-background lg:rounded-t-lg overflow-hidden">
          {/* Sticky search bar */}
          <div className="sticky top-0 z-30 bg-background border-b border-border">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Header - scrolls away */}
          <div ref={headerRef}>
            <ScrollHeader scroll={scroll} />
          </div>

          {/* Sticky tab nav */}
          <div className="sticky top-[56px] z-20 bg-background border-b border-border">
            <TabNav
              value={activeTab}
              onValueChange={setActiveTab}
              tabs={TABS}
            />
          </div>

          {/* Tab content */}
          <div className="pb-20">
            {activeTab === "feed" && (
              <FeedView
                scrollId={scrollId}
                papers={papers}
                polls={polls}
                searchQuery={searchQuery}
                userPosts={userPosts}
                commentCounts={commentCounts}
                onUpvote={handleUpvote}
                onBookmark={handleBookmark}
                onComment={handleComment}
              />
            )}
            {activeTab === "polls" && (
              <PollsView polls={polls} />
            )}
            {activeTab === "export" && (
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
