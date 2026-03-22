"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { PostDetail } from "@/components/detail/PostDetail";
import { fetchPaperFromScroll } from "@/lib/scroll-store";
import type { Paper } from "@/lib/types";

export default function PostPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const postId = params.postId as string;
  const [paper, setPaper] = useState<Paper | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchPaperFromScroll(scrollId, postId);
      if (cancelled) return;
      setPaper(stored);
      setChecked(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId, postId]);

  if (!checked) return null;

  if (!paper) {
    return (
      <div className="flex min-h-screen overflow-x-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <p className="text-muted-foreground">Paper not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <PostDetail paper={paper} scrollId={scrollId} />
      </main>
    </div>
  );
}
