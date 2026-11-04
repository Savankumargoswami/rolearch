"use client";

import { useEffect, useRef } from "react";

/**
 * Fades and lifts its content in the first time it scrolls into view. Content that is already on screen at load
 * (and everything, without JavaScript) is simply shown: only blocks below the fold are hidden, and only once mounted.
 */
export function Reveal({ children, className = "", as: Tag = "div", delay = 0, id }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "li"; delay?: number; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.classList.add("reveal-wait");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("reveal-wait");
          el.classList.add("reveal-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as React.Ref<never>} id={id} className={className} style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}
