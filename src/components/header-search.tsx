"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useEffect, useRef } from "react";
import { t } from "@/i18n";

/**
 * Header search for people and jobs, from tablet width up (phones get a search icon in the nav).
 * A plain GET form to /search; "/" focuses it from anywhere on the page.
 */
export function HeaderSearch() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form action="/search" role="search" className="relative hidden flex-1 md:block md:max-w-xs lg:max-w-sm">
      <label htmlFor="header-search" className="sr-only">
        {t("search.label")}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        id="header-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder={t("search.placeholderShort")}
        className="peer h-11 w-full rounded-full border border-line bg-surface ps-10 pe-10 text-[0.95rem] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 text-xs text-muted peer-focus:hidden"
      >
        /
      </kbd>
    </Form>
  );
}
