"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Comment } from "@/lib/types";

interface UseCommentStreamOptions {
  scrollId: string;
  /** Called when a new comment arrives via SSE */
  onComment?: (comment: Comment) => void;
}

export function useCommentStream({
  scrollId,
  onComment,
}: UseCommentStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onCommentRef = useRef(onComment);
  onCommentRef.current = onComment;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!scrollId) return;

    const es = new EventSource(`/api/scrolls/${scrollId}/comments-stream`);
    eventSourceRef.current = es;

    es.addEventListener("comment", (e) => {
      try {
        const data = JSON.parse(e.data) as Comment;
        onCommentRef.current?.(data);
      } catch {
        // ignore parse errors
      }
    });

    // Reconnect on error (browser EventSource auto-reconnects, but let's be safe)
    es.onerror = () => {
      // EventSource will auto-reconnect; nothing extra needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [scrollId]);

  return { disconnect };
}
