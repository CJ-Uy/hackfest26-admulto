"use client";

import { useState, useEffect } from "react";
import { papers as mockPapers } from "@/lib/data/papers";
import { fetchScroll } from "@/lib/scroll-store";
import type { Paper } from "@/lib/types";
import { PaperCard } from "./PaperCard";
import { FeedSkeleton } from "@/components/shared/LoadingSkeleton";

interface FeedViewProps {
  scrollId: string;
}

export function FeedView({ scrollId }: FeedViewProps) {
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;

      if (stored && stored.papers.length > 0) {
        setPapers(stored.papers);
      } else {
        setPapers(mockPapers);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  if (loading) {
    return <FeedSkeleton />;
  }

  if (papers.length === 0) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No papers found. Try a different topic.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[680px] px-4">
      <p className="mb-4 text-center text-xs text-muted-foreground">
        AI-curated research papers based on your topic. Interact to refine your
        feed.
      </p>
      <div className="space-y-4">
        {papers.map((paper, i) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            scrollId={scrollId}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
