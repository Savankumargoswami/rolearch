"use client";

import { useEffect, useRef } from "react";

/**
 * A stage for a sample screen: its data animates in (routes draw, rings sweep, bars fill) the first time it scrolls
 * into view. Content already on screen at load, and everything without JavaScript, is simply shown in its final state.
 */
export function Stage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.classList.add("stage-wait");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("stage-wait");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
