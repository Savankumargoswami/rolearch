"use client";

import { useEffect, useRef, useState } from "react";

/** The employer's website icon (via /logo, served from rolearch.com), or its initial when there isn't one. */
export function CompanyLogo({ domain, name, size = 40, className = "" }: { domain?: string | null; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A server-rendered image can fail before React attaches onError; catch that once mounted.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const box = `grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white ${className}`;
  if (!domain || failed) {
    return (
      <span aria-hidden="true" className={`${box} font-display font-semibold text-ink`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={box} style={{ width: size, height: size }}>
      {/* Small cached icon from our own /logo route; next/image would add nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={`/logo/${encodeURIComponent(domain)}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-[72%] object-contain"
      />
    </span>
  );
}
