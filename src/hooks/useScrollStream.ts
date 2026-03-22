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

const MAX_RETRIES = 4;

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
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep callback refs up to date without triggering reconnects
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
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

    function connect() {
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
        retryCountRef.current = 0;
        onCompleteRef.current?.();
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener("error", (e) => {
        // Server-sent error events (MessageEvent) are terminal
        if (e instanceof MessageEvent) {
          try {
            const data = JSON.parse(e.data);
            onErrorRef.current?.(data);
          } catch {
            // ignore
          }
          es.close();
          eventSourceRef.current = null;
          retryCountRef.current = 0;
          return;
        }

        // Connection-level failure — attempt reconnect with backoff
        es.close();
        eventSourceRef.current = null;

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** retryCountRef.current, 16000);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(connect, delay);
        } else {
          onErrorRef.current?.({ message: "Connection lost. Please refresh the page." });
          retryCountRef.current = 0;
        }
      });
    }

    connect();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [scrollId, enabled, disconnect]);

  return { disconnect };
}
