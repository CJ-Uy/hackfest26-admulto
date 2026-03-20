"use client";

import { useState, useEffect } from "react";
import { papers } from "@/lib/data/papers";
import { PaperCard } from "./PaperCard";
import { FeedSkeleton } from "@/components/shared/LoadingSkeleton";

interface FeedViewProps {
  scrollId: string;
}

export function FeedView({ scrollId }: FeedViewProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <FeedSkeleton />;
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
