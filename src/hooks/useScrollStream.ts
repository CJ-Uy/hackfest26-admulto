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

const POLL_INTERVAL = 3000;
const MAX_RETRIES = 4;

export function useScrollStream({
  scrollId,
  enabled,
  onProgress,
  onComplete,
  onError,
}: UseScrollStreamOptions) {
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failCountRef = useRef(0);

  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const disconnect = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    failCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled || !scrollId) {
      disconnect();
      return;
    }

    let stopped = false;

    async function poll() {
      if (stopped) return;

      try {
        const res = await fetch(`/api/scrolls/${scrollId}/stream`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          status?: string;
          progress?: ScrollProgress;
        };
        failCountRef.current = 0;

        if (data.status === "complete") {
          onCompleteRef.current?.();
          return; // stop polling
        }

        if (data.status === "error") {
          onErrorRef.current?.(
            { message: data.progress?.message || "Feed generation failed" },
          );
          return; // stop polling
        }

        if (data.progress) {
          onProgressRef.current?.(data.progress);
        }
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= MAX_RETRIES) {
          onErrorRef.current?.({
            message: "Connection lost. Please refresh the page.",
          });
          return; // stop polling
        }
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
  }, [scrollId, enabled, disconnect]);

  return { disconnect };
}
