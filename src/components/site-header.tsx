import Link from "next/link";
import { t } from "@/i18n";
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
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/jobs" className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft sm:inline-block">
            {t("nav.jobs")}
          </Link>
          <Link href="/#companies" className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft md:inline-block">
            {t("nav.companies")}
          </Link>
          <Link href="/signin" className="hidden whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft min-[400px]:inline-block">
            {t("nav.signIn")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-ink px-4 text-[0.95rem] font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
          >
            {t("nav.signUp")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
