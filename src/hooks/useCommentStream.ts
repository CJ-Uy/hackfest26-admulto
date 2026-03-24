"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Comment } from "@/lib/types";

interface UseCommentStreamOptions {
  scrollId: string;
  /** Called when a new comment arrives */
  onComment?: (comment: Comment) => void;
}

const POLL_INTERVAL = 5000;

export function useCommentStream({
  scrollId,
  onComment,
}: UseCommentStreamOptions) {
  const onCommentRef = useRef(onComment);
  onCommentRef.current = onComment;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sinceRef = useRef(
    new Date().toISOString().replace("T", " ").replace("Z", ""),
  );

  const disconnect = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!scrollId) return;

    let stopped = false;

    async function poll() {
      if (stopped) return;

      try {
        const res = await fetch(
          `/api/scrolls/${scrollId}/comments-stream?since=${encodeURIComponent(sinceRef.current)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.comments?.length > 0) {
            sinceRef.current = data.comments[0].createdAt;
            for (const comment of data.comments) {
              onCommentRef.current?.(comment as Comment);
            }
          }
        }
      } catch {
        // Silently retry on next poll
      }

      if (!stopped) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();

    return () => {
      stopped = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scrollId]);

  return { disconnect };
}
