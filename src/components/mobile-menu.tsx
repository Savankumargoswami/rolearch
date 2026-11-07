"use client";

import { BadgeCheck, Compass, FileStack, LayoutDashboard, Route, ShieldCheck, UserSearch, Building2, ChartNoAxesColumn, FileSearch, Map, Menu, MessageSquare, MessagesSquare, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { t } from "@/i18n";

const ICONS = { talent: UserSearch, dashboard: LayoutDashboard, privacy: ShieldCheck, gaps: Route, versions: FileStack, discover: Compass, interview: MessagesSquare, skills: BadgeCheck, ats: FileSearch, roadmaps: Map, companies: Building2, posts: MessageSquare, tracker: ChartNoAxesColumn, hiring: Building2, join: UserPlus };
export type MenuItem = { href: string; label: string; icon: keyof typeof ICONS; primary?: boolean };

/** The header's menu, on every screen size: everything that isn't search, Jobs or Profile. Closes on a link, a tap outside, or Escape. */
export function MobileMenu({ items }: { items: MenuItem[] }) {
  const box = useRef<HTMLDetailsElement>(null);
  const close = () => box.current?.removeAttribute("open");
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (box.current?.open && !box.current.contains(e.target as Node)) box.current.removeAttribute("open");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") box.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={box} className="group relative shrink-0">
      <summary
        aria-label={t("nav.menu")}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface px-2.5 text-[0.95rem] text-ink transition-colors duration-200 hover:border-ink sm:px-4 [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden="true" className="size-5 group-open:hidden" />
        <X aria-hidden="true" className="hidden size-5 group-open:block" />
        <span className="hidden sm:inline">{t("nav.menu")}</span>
      </summary>
      <ul className="absolute end-0 top-13 z-30 w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-[0_18px_40px_-18px_rgba(14,31,47,0.45)]">
        {items.map((l) => {
          const Icon = ICONS[l.icon];
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={close}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.95rem] ${l.primary ? "mb-1 bg-ink font-medium text-paper hover:bg-ink-hover" : "hover:bg-ink-soft"}`}
              >
                <Icon aria-hidden="true" className={`size-[1.15rem] ${l.primary ? "" : "text-muted"}`} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
