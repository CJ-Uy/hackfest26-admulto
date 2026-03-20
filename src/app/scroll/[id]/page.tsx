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
import type { ScrollSession, Paper, Poll } from "@/lib/types";

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
  const [commentedPapers, setCommentedPapers] = useState<Map<string, number>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);

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
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  // Observe header visibility for sticky behavior
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

  const handleComment = useCallback((paperId: string) => {
    setCommentedPapers((prev) => {
      const next = new Map(prev);
      next.set(paperId, (next.get(paperId) || 0) + 1);
      return next;
    });
  }, []);

  if (!scroll) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex flex-1 justify-center">
        {/* Main content column */}
        <main className="w-full max-w-[680px] flex-1">
          {/* Sticky search bar */}
          <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Header - scrolls away */}
          <div ref={headerRef}>
            <ScrollHeader scroll={scroll} />
          </div>

          {/* Sticky tab nav */}
          <div
            className={`sticky z-20 border-b border-border bg-background/95 backdrop-blur-md ${
              headerVisible ? "top-[57px]" : "top-[57px]"
            }`}
          >
            <TabNav
              value={activeTab}
              onValueChange={setActiveTab}
              tabs={TABS}
            />
          </div>

          {/* Tab content */}
          <div className="pb-12">
            {activeTab === "feed" && (
              <FeedView
                scrollId={scrollId}
                papers={papers}
                polls={polls}
                searchQuery={searchQuery}
                onUpvote={handleUpvote}
                onComment={handleComment}
              />
            )}
            {activeTab === "polls" && (
              <PollsView polls={polls} />
            )}
            {activeTab === "export" && <ExportView scrollId={scrollId} />}
          </div>
        </main>

        {/* Right sidebar - desktop only */}
        <RightSidebar
          scroll={scroll}
          papers={papers}
          upvotedPapers={upvotedPapers}
          commentedPapers={commentedPapers}
          scrollId={scrollId}
        />
      </div>

      {/* FAB for creating posts */}
      <CreatePostFAB scrollId={scrollId} />
    </div>
  );
}
