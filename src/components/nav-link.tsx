"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Props = { href: string; match?: RegExp; className?: string; children: ReactNode };

/**
 * A header link that marks itself as the current section (aria-current) on its own pages.
 * The current path is only known at request time, so the highlight streams in behind Suspense;
 * until then the plain link shows.
 */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} className={props.className}>{props.children}</Link>}>
      <ActiveLink {...props} />
    </Suspense>
  );
}

function ActiveLink({ href, match, className, children }: Props) {
  const pathname = usePathname();
  const active = (match ?? new RegExp(`^${href}(/|$)`)).test(pathname);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${className ?? ""} ${active ? "bg-ink-soft font-medium" : ""}`}>
      {children}
    </Link>
  );
}
