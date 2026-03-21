"use client";

import { useEffect, useRef, useCallback } from "react";

export interface ScrollProgress {
  step: string;
  papersProcessed?: number;
  total?: number;
  message?: string;
}

interface UseScrollStreamOptions {
  scrollId: string;
  /** Whether to connect the stream (e.g. only when status is "generating") */
  enabled: boolean;
  onProgress?: (progress: ScrollProgress) => void;
  onComplete?: () => void;
  onError?: (error: { message: string }) => void;
}

export function useScrollStream({
  scrollId,
  enabled,
  onProgress,
  onComplete,
  onError,
}: UseScrollStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep callback refs up to date without triggering reconnects
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !scrollId) {
      disconnect();
      return;
    }

    const es = new EventSource(`/api/scrolls/${scrollId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data);
        onProgressRef.current?.(data.progress);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("complete", () => {
      onCompleteRef.current?.();
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener("error", (e) => {
      // SSE "error" event from our server
      if (e instanceof MessageEvent) {
        try {
          const data = JSON.parse(e.data);
          onErrorRef.current?.(data);
        } catch {
          // ignore
        }
      }
      es.close();
      eventSourceRef.current = null;
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [scrollId, enabled, disconnect]);

  return { disconnect };
}
