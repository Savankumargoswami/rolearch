"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A header link that marks itself as the current section (aria-current) on its own pages. */
export function NavLink({ href, match, className, children }: { href: string; match?: RegExp; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = (match ?? new RegExp(`^${href}(/|$)`)).test(pathname);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className ?? ""} ${active ? "bg-ink-soft font-medium" : ""}`}
    >
      {children}
    </Link>
  );
}
