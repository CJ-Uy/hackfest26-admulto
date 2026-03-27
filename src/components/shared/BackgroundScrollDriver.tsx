"use client";

import { useEffect, useRef } from "react";

/** How often to scan for newly-created generating scrolls (ms). */
const SCAN_INTERVAL = 5000;
/** Gap between consecutive process-next calls for a single scroll (ms). */
const BETWEEN_PAPERS = 2000;
/** Retry delay after a network/server error (ms). */
const ERROR_RETRY = 3000;

/**
 * Mounts once in the layout. Scans for scrolls with status "generating" and
 * drives process-next for each one concurrently, so generation continues
 * regardless of which page the user is on. Multiple scrolls can process in
 * parallel.
 */
export function BackgroundScrollDriver() {
  const drivingRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function driveScroll(scrollId: string) {
      if (drivingRef.current.has(scrollId)) return;
      drivingRef.current.add(scrollId);

      try {
        while (mountedRef.current) {
          try {
            const res = await fetch("/api/generate-feed/process-next", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scrollId }),
            });

            if (!mountedRef.current) break;

            if (!res.ok) {
              await delay(ERROR_RETRY);
              continue;
            }

            const data = (await res.json()) as {
              status: string;
              done?: boolean;
            };

            if (data.done || data.status === "complete" || data.status === "error") {
              break;
            }

            await delay(BETWEEN_PAPERS);
          } catch {
            if (!mountedRef.current) break;
            await delay(ERROR_RETRY);
          }
        }
      } finally {
        drivingRef.current.delete(scrollId);
      }
    }

    async function scanAndDrive() {
      if (!mountedRef.current) return;
      try {
        const res = await fetch("/api/scrolls");
        if (!res.ok) return;
        const data = (await res.json()) as { id: string; status: string }[];
        const generating = data.filter((s) => s.status === "generating");
        for (const scroll of generating) {
          // fire-and-forget: each scroll drives itself independently
          driveScroll(scroll.id);
        }
      } catch {
        // ignore scan errors
      }
    }

    scanAndDrive();
    const interval = setInterval(scanAndDrive, SCAN_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return null;
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
