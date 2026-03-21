"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { UserPostDetail } from "@/components/detail/UserPostDetail";
import type { UserPost } from "@/lib/types";

export default function UserPostPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const postId = params.postId as string;
  const [post, setPost] = useState<UserPost | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/user-posts?scrollId=${scrollId}`);
        if (!res.ok) {
          setChecked(true);
          return;
        }
        const posts = (await res.json()) as UserPost[];
        if (cancelled) return;
        const found = posts.find((p) => p.id === postId);
        setPost(found ?? null);
      } catch {
        // ignore
      }
      setChecked(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId, postId]);

  if (!checked) return null;

  if (!post) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Post not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <UserPostDetail post={post} scrollId={scrollId} />
      </main>
    </div>
  );
}
