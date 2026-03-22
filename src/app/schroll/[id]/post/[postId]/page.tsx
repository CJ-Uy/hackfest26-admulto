"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { PostDetail } from "@/components/detail/PostDetail";
import { fetchScroll } from "@/lib/scroll-store";
import { DetailSkeleton } from "@/components/shared/LoadingSkeleton";
import type { Paper, ScrollSession, UserPost } from "@/lib/types";

export default function PostPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const postId = params.postId as string;
  const [paper, setPaper] = useState<Paper | null>(null);
  const [scrollPapers, setScrollPapers] = useState<
    { id: string; title: string; authors: string[]; doi: string }[]
  >([]);
  const [checked, setChecked] = useState(false);

  // Sidebar state (lazy-loaded)
  const [scroll, setScroll] = useState<ScrollSession | null>(null);
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [upvotedPapers, setUpvotedPapers] = useState<Set<string>>(new Set());
  const [downvotedPapers, setDownvotedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [commentCounts] = useState<Map<string, number>>(new Map());

  // Primary fetch: single paper only
  useEffect(() => {
    let cancelled = false;

    async function loadPaper() {
      try {
        const res = await fetch(`/api/papers/${postId}`);
        if (!res.ok) {
          setChecked(true);
          return;
        }
        const data = (await res.json()) as {
          paper: Paper;
          scrollPapers: { id: string; title: string; authors: string[]; doi: string }[];
        };
        if (cancelled) return;
        setPaper(data.paper);
        setScrollPapers(data.scrollPapers);
      } catch {
        // network error
      }
      if (!cancelled) setChecked(true);
    }

    loadPaper();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Lazy-load sidebar data (non-blocking)
  useEffect(() => {
    let cancelled = false;

    async function loadSidebar() {
      const stored = await fetchScroll(scrollId);
      if (cancelled || !stored) return;
      setScroll(stored.scroll);
      setAllPapers(stored.papers);
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

    loadSidebar();
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  if (!checked) {
    return (
      <div className="flex min-h-screen bg-[#dae0e6]">
        <Sidebar />
        <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
          <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
            <DetailSkeleton />
          </main>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex min-h-screen bg-[#dae0e6]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Paper not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#dae0e6]">
      <Sidebar />

      <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
          <PostDetail
            paper={paper}
            scrollId={scrollId}
            scrollPapers={scrollPapers}
          />
        </main>

        {scroll && (
          <RightSidebar
            scroll={scroll}
            papers={allPapers}
            upvotedPapers={upvotedPapers}
            downvotedPapers={downvotedPapers}
            bookmarkedPapers={bookmarkedPapers}
            commentCounts={commentCounts}
            userPosts={userPosts}
            scrollId={scrollId}
          />
        )}
      </div>
    </div>
  );
}
