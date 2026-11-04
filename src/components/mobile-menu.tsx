"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { t } from "@/i18n";

/** Below desktop width the header hides some sections; this menu keeps them reachable. Closes on a link, a tap outside, or Escape. */
export function MobileMenu() {
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
  const links = [
    { href: "/skills", label: t("nav.skills") },
    { href: "/ats", label: t("nav.ats"), wide: true },
    { href: "/roadmaps", label: t("nav.roadmaps"), wide: true },
    { href: "/employers", label: t("nav.companies"), wide: true },
  ];
  return (
    <details ref={box} className="relative lg:hidden">
      <summary
        aria-label={t("nav.menu")}
        className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-ink hover:bg-ink-soft [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </summary>
      <ul className="absolute end-0 top-12 z-30 w-56 rounded-2xl border border-line bg-surface p-2 shadow-lg">
        {links.map((l) => (
          <li key={l.href} className={l.wide ? "md:hidden" : undefined}>
            <Link href={l.href} onClick={close} className="flex min-h-11 items-center rounded-xl px-3 text-[0.95rem] hover:bg-ink-soft">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
