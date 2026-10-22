import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JobRow } from "@/components/job-row";
import { JobsControls } from "@/components/jobs-explorer";
import { correctQuery, getJobFeed, jobCategories, searchJobs, type JobQuery, type Near } from "@/data/db";
import { locale, t } from "@/i18n";
import { isCategory } from "@/lib/categories";
import { formatJobCount, toQueryString } from "@/lib/job-query";
import { parseQuery } from "@/lib/query-parse";
import { viewerLocation } from "@/lib/viewer-location";
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
      near: one("near") === "only" ? "only" : one("near") === "off" ? "off" : "auto",
      exact: one("exact") === "1",
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
  const [result, cats, feed] = await Promise.all([findJobs(filters, page), jobCategories(), getJobFeed()]);
  const { jobs, total, corrected, mode, loc, parsed, partial } = result;
  const counts = Object.fromEntries(cats.map((c) => [c.category, c.n]));
  const link = (patch: Partial<JobQuery>) => `/jobs${toQueryString({ ...filters, ...patch })}`;
  const understood = [
    parsed.country?.name,
    parsed.remote && !filters.remote && t("jobs.understoodRemote"),
    parsed.visa && !filters.visa && t("jobs.understoodVisa"),
    parsed.entry && filters.level === "any" && t("jobs.understoodEntry"),
  ].filter(Boolean);
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
      <div className="mt-2 flex flex-col gap-1.5 text-sm">
        {corrected && (
          <p>
            {t("jobs.correctedLead")} <strong>{corrected}</strong>.{" "}
            <Link href={link({ exact: true })} className="underline underline-offset-4 hover:decoration-2">
              {t("jobs.searchExact", { q: filters.q })}
            </Link>
          </p>
        )}
        {understood.length > 0 && <p className="text-muted">{t("jobs.understood", { f: understood.join(", ") })}</p>}
        {partial && <p className="text-muted">{t("jobs.partialMatch")}</p>}
        {loc && mode !== "none" && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft px-3 py-1">
              <MapPin aria-hidden="true" className="size-3.5" />
              {mode === "only" ? t("jobs.nearOnly", { place: loc.label }) : t("jobs.nearFirst", { place: loc.label })}
            </span>
            {mode === "boost" && (
              <Link href={link({ near: "only" })} className="underline underline-offset-4">{t("jobs.nearShowOnly")}</Link>
            )}
            <Link href={link({ near: "off" })} className="underline underline-offset-4">{t("jobs.nearAnywhere")}</Link>
          </p>
        )}
        {loc && mode === "none" && filters.near === "off" && (
          <p>
            <Link href={link({ near: "auto" })} className="inline-flex items-center gap-1.5 underline underline-offset-4">
              <MapPin aria-hidden="true" className="size-3.5" />
              {t("jobs.nearShow", { place: loc.label })}
            </Link>
          </p>
        )}
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

/**
 * Runs a search the way people mean it: filler words dropped; "remote"/"visa"/"near me"/"entry level" and a named
 * country ("in india", "in the usa") turned into filters; jobs near the visitor first (only nearby when just browsing);
 * likely typos fixed; and when no job has every word, the jobs with the most of them.
 */
async function findJobs(filters: JobQuery, page: number) {
  const parsed = parseQuery(filters.q);
  const loc = await viewerLocation();
  const effective: JobQuery = {
    ...filters,
    q: parsed.text,
    remote: filters.remote || parsed.remote,
    visa: filters.visa || parsed.visa,
    level: filters.level === "any" && parsed.entry ? "entry" : filters.level,
    country: parsed.country?.code,
  };
  // A named country or remote work replaces "near me".
  const located = loc && effective.where === "anywhere" && !effective.remote && !effective.country && filters.near !== "off";
  const automatic = filters.near !== "only" && !parsed.nearMe;
  let mode: "none" | "boost" | "only" = !located ? "none" : !automatic || !effective.q ? "only" : "boost";
  const near = (m: typeof mode): Near => (loc && m !== "none" ? { lat: loc.lat, lon: loc.lon, only: m === "only" } : null);

  // The typo check runs alongside the search instead of after it.
  const fixing = effective.q && !filters.exact ? correctQuery(effective.q) : Promise.resolve(null);
  let res = await searchJobs(effective, page, PER_PAGE, near(mode));
  // Browsing near someone with no jobs around: show everything instead of an empty page.
  if (mode === "only" && automatic && res.total === 0) {
    mode = "none";
    res = await searchJobs(effective, page, PER_PAGE, null);
  }
  let q = effective.q;
  let corrected: string | null = null;
  const fixed = await fixing;
  // Use the corrected words when the typed ones found little and the corrected ones find clearly more, so a rare
  // but real word ("scala") isn't swapped for a common one ("scale").
  if (fixed && fixed !== effective.q && res.total < 20) {
    const retry = await searchJobs({ ...effective, q: fixed }, page, PER_PAGE, near(mode));
    if (retry.total > Math.max(res.total * 3, res.total + 2) || (res.total === 0 && retry.total > 0)) {
      res = retry;
      q = fixed;
      corrected = fixed;
    }
  }
  // No job has every word: show the jobs with the most of them, best first.
  let partial = false;
  if (res.total === 0 && q.split(/\s+/).filter(Boolean).length > 1) {
    const some = await searchJobs({ ...effective, q, any: true }, page, PER_PAGE, near(mode));
    if (some.total > 0) {
      res = some;
      partial = true;
    }
  }
  return { ...res, corrected, mode, loc, parsed, partial };
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
