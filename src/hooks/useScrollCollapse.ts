"use client";

import { useState, useEffect, useRef, type RefObject } from "react";

export function useScrollCollapse(
  containerRef?: RefObject<HTMLElement | null>,
  threshold = 120,
) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = el!.scrollTop;

        if (currentY < 50) {
          setIsCollapsed(false);
        } else if (currentY > threshold) {
          const delta = currentY - lastScrollY.current;
          if (delta > 10) {
            setIsCollapsed(true);
          } else if (delta < -10) {
            setIsCollapsed(false);
          }
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, threshold]);

  return { isCollapsed };
}
