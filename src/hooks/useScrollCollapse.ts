"use client";

import { useState, useEffect, useRef } from "react";

export function useScrollCollapse(threshold = 120) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;

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

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return { isCollapsed };
}
