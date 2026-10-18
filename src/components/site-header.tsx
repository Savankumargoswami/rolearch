import { Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { GuestLinks, HeaderAccount } from "./header-account";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header style={{ viewTransitionName: "site-header" }} className="relative z-20 border-b border-line/70 bg-paper/90 backdrop-blur-sm">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={t("nav.home")} className="rounded-md text-ink">
          <Logo height={26} />
        </Link>
        <HeaderSearch />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" aria-label={t("search.label")} className="grid size-11 place-items-center rounded-full text-ink hover:bg-ink-soft md:hidden">
            <Search aria-hidden="true" className="size-5" />
          </Link>
          <Link href="/jobs" className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft sm:inline-block">
            {t("nav.jobs")}
          </Link>
          <Link href="/#companies" className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft md:inline-block">
            {t("nav.companies")}
          </Link>
          <Suspense fallback={<GuestLinks />}>
            <HeaderAccount />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
