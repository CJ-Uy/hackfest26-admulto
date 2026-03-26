"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Navbar } from "@/components/shared/Navbar";
import { RightSidebar } from "@/components/shared/RightSidebar";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
import { UserPostDetail } from "@/components/detail/UserPostDetail";
import { fetchScroll } from "@/lib/scroll-store";
import {
  RightSidebarSkeleton,
  UserPostDetailSkeleton,
} from "@/components/shared/LoadingSkeleton";
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
  const [yourCommentCounts, setYourCommentCounts] = useState<
    Map<string, number>
  >(new Map());
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [stored, countRes] = await Promise.all([
        fetchScroll(scrollId),
        fetch(`/api/comments/counts?scrollId=${scrollId}&onlyMine=true`),
      ]);

      if (cancelled) return;

      if (countRes.ok) {
        const counts: Record<string, number> = await countRes.json();
        setYourCommentCounts(new Map(Object.entries(counts)));
      }

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
      <div className="bg-page-bg min-h-screen">
        <Navbar />
        <div className="flex">
          <Sidebar showMobileTrigger={false} />
          <main className="w-full min-w-0 flex-1 border-x border-border">
            <UserPostDetailSkeleton />
          </main>
          <RightSidebarSkeleton />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="bg-page-bg min-h-screen">
        <Navbar />
        <div className="flex">
          <Sidebar showMobileTrigger={false} />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Post not found.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-page-bg min-h-screen">
      <Navbar />

      <div className="flex">
        <Sidebar showMobileTrigger={false} />

        <main className="w-full min-w-0 flex-1 border-x border-border pb-24 md:pb-0">
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

        {scroll ? (
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
        ) : (
          <RightSidebarSkeleton />
        )}
      </div>

      {scroll && (
        <MobileBottomNav
          scrollId={scrollId}
          onPost={(newPost) => setUserPosts((prev) => [newPost, ...prev])}
          scroll={scroll}
          papers={papers}
          upvotedPapers={upvotedPapers}
          downvotedPapers={downvotedPapers}
          bookmarkedPapers={bookmarkedPapers}
          yourCommentCounts={yourCommentCounts}
          userPosts={userPosts}
        />
      )}
    </div>
  );
}
