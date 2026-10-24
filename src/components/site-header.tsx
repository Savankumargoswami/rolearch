import { BriefcaseBusiness, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { GuestLinks, HeaderAccount } from "./header-account";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

export function SiteHeader() {
  return (
    <header style={{ viewTransitionName: "site-header" }} className="relative z-20 border-b border-line/70 bg-paper/90 backdrop-blur-sm">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label={t("nav.home")} className="shrink-0 rounded-md text-ink">
          <Logo height={26} />
        </Link>
        <HeaderSearch />
        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 sm:gap-2">
          <Link href="/search" aria-label={t("search.label")} className="grid size-11 place-items-center rounded-full text-ink hover:bg-ink-soft md:hidden">
            <Search aria-hidden="true" className="size-5" />
          </Link>
          <NavLink
            href="/jobs"
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[0.95rem] text-ink hover:bg-ink-soft sm:px-3"
          >
            <BriefcaseBusiness aria-hidden="true" className="size-[1.1rem]" />
            {t("nav.jobs")}
          </NavLink>
          <Link href="/ats" className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft md:inline-block">
            {t("nav.ats")}
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
