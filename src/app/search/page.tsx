import { ArrowRight, Building2, Search, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { JobRow } from "@/components/job-row";
import { searchJobs } from "@/data/db";
import { t } from "@/i18n";
import { searchPeople, viewerId, type Person } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("search.title"), robots: { index: false } };

type Search = Promise<{ q?: string; type?: string }>;
type Tab = "all" | "people" | "jobs";

const suggestions = ["Data engineer", "Python", "Machine learning", "Analytics", "Remote"];

export default function SearchPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<SearchForm q="" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchForm({ q, tab = "all" }: { q: string; tab?: Tab }) {
  return (
    <Form action="/search" role="search" className="relative">
      <label htmlFor="search-q" className="sr-only">
        {t("search.label")}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        id="search-q"
        name="q"
        type="search"
        defaultValue={q}
        autoFocus={!q}
        autoComplete="off"
        placeholder={t("search.placeholder")}
        className="h-16 w-full rounded-2xl border border-line bg-surface ps-14 pe-32 text-lg shadow-[0_8px_24px_-16px_rgba(14,31,47,0.25)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_4px_rgba(14,31,47,0.1)]"
      />
      {tab !== "all" && <input type="hidden" name="type" value={tab} />}
      <button
        type="submit"
        className="absolute end-2.5 top-1/2 inline-flex min-h-11 -translate-y-1/2 cursor-pointer items-center rounded-xl bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
      >
        {t("search.button")}
      </button>
    </Form>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tab: Tab = params.type === "people" || params.type === "jobs" ? params.type : "all";

  if (!q) {
    return (
      <>
        <h1 className="mb-6 font-display text-4xl font-semibold tracking-[-0.03em]">{t("search.title")}</h1>
        <SearchForm q="" />
        <p className="mt-6 text-muted">{t("search.emptyLead")}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s}>
              <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 hover:border-ink">
                {s}
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const supabase = await createClient();
  const me = await viewerId(supabase);
  const [people, found] = await Promise.all([
    me && tab !== "jobs" ? searchPeople(supabase, q, tab === "people" ? 50 : 12) : Promise.resolve([] as Person[]),
    tab === "people"
      ? Promise.resolve({ jobs: [], total: 0 })
      : searchJobs({ q, cat: "all", where: "anywhere", remote: false, visa: false, pay: false, level: "any", sort: "match" }, 1, tab === "jobs" ? 40 : 6),
  ]);
  const jobs = { length: found.total };
  const shownJobs = found.jobs;
  const href = (type: Tab) => `/search?q=${encodeURIComponent(q)}${type === "all" ? "" : `&type=${type}`}`;
  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-medium transition-colors duration-200 ${active ? "bg-ink text-paper" : "text-ink hover:bg-ink-soft"}`;

  return (
    <>
      <h1 className="sr-only">{t("search.resultsFor", { q })}</h1>
      <SearchForm q={q} tab={tab} />
      <nav aria-label={t("search.title")} className="mt-5 flex flex-wrap gap-2">
        <Link href={href("all")} aria-current={tab === "all" ? "page" : undefined} className={tabClass(tab === "all")}>
          {t("search.tabAll")}
        </Link>
        <Link href={href("people")} aria-current={tab === "people" ? "page" : undefined} className={tabClass(tab === "people")}>
          {t("search.tabPeople")}
        </Link>
        <Link href={href("jobs")} aria-current={tab === "jobs" ? "page" : undefined} className={tabClass(tab === "jobs")}>
          {t("search.tabJobs")}
          {tab !== "people" && <span className="rounded-full bg-signal/25 px-2 text-xs tabular-nums">{jobs.length}</span>}
        </Link>
      </nav>

      {tab !== "jobs" && (
        <section aria-labelledby="people-h" className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 id="people-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
              {t("search.people")}
            </h2>
            {tab === "all" && people.length >= 12 && (
              <Link href={href("people")} className="inline-flex items-center gap-1 font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                {t("search.seeAllPeople")}
                <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
              </Link>
            )}
          </div>
          {!me ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-muted">
              <Link href="/signin" className="font-medium text-ink underline underline-offset-4">
                {t("nav.signIn")}
              </Link>{" "}
              {t("search.signInForPeople")}
            </p>
          ) : people.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-muted">{t("search.noPeople", { q })}</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {people.map((p, i) => (
                <li key={p.id} className="rise" style={{ "--delay": `${Math.min(i, 8) * 40}ms` } as React.CSSProperties}>
                  <PersonCard person={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab !== "people" && (
        <section aria-labelledby="jobs-h" className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 id="jobs-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
              {t("search.jobs")}
            </h2>
            {jobs.length > shownJobs.length && (
              <Link href={`/jobs?q=${encodeURIComponent(q)}`} className="inline-flex items-center gap-1 font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                {t("search.seeAllJobs", { n: jobs.length })}
                <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
              </Link>
            )}
          </div>
          {shownJobs.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-muted">{t("search.noJobs", { q })}</p>
          ) : (
            <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
              {shownJobs.map((job) => (
                <li key={job.id}>
                  <JobRow job={job} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function PersonCard({ person: p }: { person: Person }) {
  return (
    <Link
      href={`/u/${p.id}`}
      className="group flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_10px_24px_-16px_rgba(14,31,47,0.35)]"
    >
      <Avatar url={p.avatarUrl} name={p.name} size={56} className="ring-2 ring-signal ring-offset-2 ring-offset-surface" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-display text-lg font-semibold">{p.name}</span>
          {p.isCompany ? (
            <Building2 aria-label={t("search.company")} className="size-4 shrink-0 text-signal-ink" />
          ) : (
            <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted" />
          )}
        </span>
        {p.headline && <span className="block truncate text-[0.95rem]">{p.headline}</span>}
        {p.location && <span className="block truncate text-sm text-muted">{p.location}</span>}
        {p.skills.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {p.skills.slice(0, 4).map((s) => (
              <span key={s} className="rounded-full bg-ink-soft px-2.5 py-0.5 text-xs font-medium">
                {s}
              </span>
            ))}
          </span>
        )}
      </span>
      <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </Link>
  );
}
