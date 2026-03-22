"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { UserPostDetail } from "@/components/detail/UserPostDetail";
import { fetchScroll } from "@/lib/scroll-store";
import { DetailSkeleton } from "@/components/shared/LoadingSkeleton";
import type { UserPost, Paper, ScrollSession } from "@/lib/types";

export default function UserPostPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const postId = params.postId as string;
  const [post, setPost] = useState<UserPost | null>(null);
  const [scroll, setScroll] = useState<ScrollSession | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [upvotedPapers, setUpvotedPapers] = useState<Set<string>>(new Set());
  const [downvotedPapers, setDownvotedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(
    new Set(),
  );
  const [commentCounts] = useState<Map<string, number>>(new Map());
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;
      if (stored) {
        setScroll(stored.scroll);
        setPapers(stored.papers);
        setUserPosts(stored.userPosts || []);
        const found = (stored.userPosts || []).find((p) => p.id === postId);
        setPost(found ?? null);
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
      setChecked(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId, postId]);

  if (!checked) {
    return (
      <div className="flex min-h-screen overflow-x-hidden bg-page-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
          <main className="bg-background w-full min-w-0 max-w-[780px] flex-1 lg:rounded-t-lg">
            <DetailSkeleton />
          </main>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen overflow-x-hidden bg-page-bg">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Post not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-page-bg">
      <Sidebar />

      <div className="flex min-w-0 flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        <main className="bg-background w-full min-w-0 max-w-[780px] flex-1 lg:rounded-t-lg">
          <UserPostDetail
            post={post}
            scrollId={scrollId}
            scrollPapers={papers.map((p) => ({
              id: p.id,
              title: p.title,
              authors: p.authors,
              doi: p.doi,
            }))}
          />
        </main>

        {scroll && (
          <RightSidebar
            scroll={scroll}
            papers={papers}
            upvotedPapers={upvotedPapers}
            downvotedPapers={downvotedPapers}
            bookmarkedPapers={bookmarkedPapers}
            yourCommentCounts={commentCounts}
            userPosts={userPosts}
            scrollId={scrollId}
          />
        )}
      </div>
    </div>
  );
}
