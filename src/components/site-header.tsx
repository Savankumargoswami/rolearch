import { BriefcaseBusiness, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { GuestLinks, HeaderAccount } from "./header-account";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

/** Search, Jobs and Profile stay in view on every screen; everything else lives in the Menu. */
export function SiteHeader() {
  return (
    <header style={{ viewTransitionName: "site-header" }} className="glass sticky top-0 z-30 shadow-[0_1px_0_rgb(14_31_47/0.08),0_8px_24px_-16px_rgb(14_31_47/0.25)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label={t("nav.home")} className="shrink-0 rounded-md text-ink">
          <Logo height={26} className="h-[22px] w-auto max-[359px]:h-[17px] sm:h-[26px]" />
        </Link>
        <HeaderSearch />
        <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <Link href="/search" aria-label={t("search.label")} className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-ink-soft sm:size-11 md:hidden">
            <Search aria-hidden="true" className="size-5" />
          </Link>
          <NavLink
            href="/jobs"
            className="inline-flex min-h-11 min-w-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[0.95rem] text-ink hover:bg-ink-soft sm:px-3"
          >
            <BriefcaseBusiness aria-hidden="true" className="size-[1.1rem]" />
            <span className="max-sm:sr-only">{t("nav.jobs")}</span>
          </NavLink>
          <Suspense fallback={<GuestLinks />}>
            <HeaderAccount />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
