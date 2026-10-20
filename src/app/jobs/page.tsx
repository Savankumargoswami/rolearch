import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JobRow } from "@/components/job-row";
import { JobsControls } from "@/components/jobs-explorer";
import { getJobFeed, jobCategories, searchJobs, type JobQuery } from "@/data/db";
import { locale, t } from "@/i18n";
import { isCategory } from "@/lib/categories";
import { formatJobCount, toQueryString } from "@/lib/job-query";
import { requireMember } from "@/lib/require-member";
import { whereOptions, type Where } from "@/lib/regions";

export const metadata: Metadata = {
  title: t("jobs.title"),
  robots: { index: false },
};

type Search = Promise<Record<string, string | string[] | undefined>>;
const PER_PAGE = 40;
const nf = new Intl.NumberFormat("en");

function parse(sp: Record<string, string | string[] | undefined>): { filters: JobQuery; page: number } {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const where = one("where") as Where;
  const cat = one("cat");
  const level = one("level");
  return {
    page: Math.min(250, Math.max(1, Number.parseInt(one("page"), 10) || 1)),
    filters: {
      q: one("q").slice(0, 100),
      cat: cat === "white" || cat === "blue" || isCategory(cat) ? cat : "all",
      where: whereOptions.includes(where) ? where : "anywhere",
      remote: one("remote") === "1",
      visa: one("visa") === "1",
      pay: one("pay") === "1",
      level: ["entry", "mid", "senior", "lead"].includes(level) ? level : "any",
      sort: one("sort") === "newest" ? "newest" : "match",
    },
  };
}

export default function JobsPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <h1 className="sr-only">{t("jobs.title")}</h1>
      <Suspense fallback={<Skeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const { filters, page } = parse(await searchParams);
  await requireMember(`/jobs${toQueryString(filters, page)}`);
  const [{ jobs, total }, cats, feed] = await Promise.all([searchJobs(filters, page, PER_PAGE), jobCategories(), getJobFeed()]);
  const counts = Object.fromEntries(cats.map((c) => [c.category, c.n]));
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <>
      <JobsControls filters={filters} counts={counts} />
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p aria-live="polite" className="font-display text-xl font-semibold tabular-nums">
          {total === 1 ? t("jobs.countOne") : t("jobs.count", { n: formatJobCount(total) })}
        </p>
        <p className="text-sm text-muted">{updatedNote(feed.updatedAt, feed.companies)}</p>
      </div>

      {jobs.length > 0 ? (
        <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobRow job={job} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t("jobs.noneTitle")}</h2>
          <p className="mt-1 text-muted">{t("jobs.noneBody")}</p>
          <Link href="/jobs" className="mt-4 inline-flex h-10 items-center rounded-full border border-ink px-4 text-[0.92rem] hover:bg-ink hover:text-paper">
            {t("jobs.clear")}
          </Link>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t("jobs.pages")} className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={`/jobs${toQueryString(filters, page - 1)}`} scroll className="inline-flex min-h-12 items-center gap-1 rounded-full border border-ink px-5 font-medium hover:bg-ink hover:text-paper">
              <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
              {t("jobs.prev")}
            </Link>
          ) : null}
          <span className="text-sm tabular-nums text-muted">{t("jobs.pageOf", { n: page, total: nf.format(Math.min(pages, 250)) })}</span>
          {page < Math.min(pages, 250) ? (
            <Link href={`/jobs${toQueryString(filters, page + 1)}`} scroll className="inline-flex min-h-12 items-center gap-1 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
              {t("jobs.next")}
              <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />
            </Link>
          ) : null}
        </nav>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-[9.5rem] border-b border-line" />
      <div className="mt-5 h-7 w-40 animate-pulse rounded bg-ink-soft" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-soft/70" />
        ))}
      </div>
    </div>
  );
}

function updatedNote(updatedAt: string | null, employers: number) {
  if (!updatedAt) return t("jobs.sampleNote");
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(updatedAt));
  return t("jobs.liveNote", { when: `${when} UTC`, k: nf.format(employers) });
}
