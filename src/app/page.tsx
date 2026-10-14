import Link from "next/link";
import { ViewTransition } from "react";
import { HeroSearch } from "@/components/hero-search";
import { JobRow } from "@/components/job-row";
import { MeridianMap } from "@/components/meridian-map";
import { getJobFeed } from "@/data/db";
import { m, t } from "@/i18n";
import { count } from "@/lib/format";
import { filterJobs, emptyFilters } from "@/lib/search";

const quick = [
  { label: "Remote data engineer", href: "/jobs?q=data+engineer&where=remote" },
  { label: "Visa sponsorship", href: "/jobs?visa=1" },
  { label: "India", href: "/jobs?where=india" },
  { label: "Europe", href: "/jobs?where=europe" },
  { label: "Entry level", href: "/jobs?level=entry" },
];

const pageTransition = {
  enter: { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" },
  exit: { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" },
} as const;

export default async function Home() {
  const feed = await getJobFeed();
  const top = filterJobs(feed.jobs, emptyFilters).slice(0, 5);
  const copy = m().home;

  return (
    <ViewTransition enter={pageTransition.enter} exit={pageTransition.exit} default="none">
      <div>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-20">
          <h1
            className="rise max-w-[15ch] font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.6rem]"
            style={{ fontVariationSettings: '"opsz" 96' }}
          >
            {t("hero.title")}
          </h1>
          <p className="rise mt-5 max-w-[52ch] text-lg text-muted text-pretty sm:text-xl" style={{ "--delay": "90ms" } as React.CSSProperties}>
            {t("hero.lead")}
          </p>
          <div className="rise mt-8 max-w-4xl" style={{ "--delay": "180ms" } as React.CSSProperties}>
            <HeroSearch />
            <div className="rail -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="shrink-0 text-sm text-muted">{t("hero.quick")}</span>
              {quick.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="shrink-0 rounded-full border border-line px-3.5 py-2 text-sm text-ink transition-colors duration-200 hover:border-ink"
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-14 sm:mt-16">
            <MeridianMap jobs={feed.jobs} />
          </div>
        </section>

        {/* Fresh jobs */}
        <section aria-labelledby="fresh" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
            <div>
              <h2 id="fresh" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                {t("home.freshTitle")}
              </h2>
              <p className="mt-2 max-w-[60ch] text-muted">{t("home.freshLead", { n: count(feed.jobs.length), k: feed.companies, c: feed.countries })}</p>
            </div>
            <Link href="/jobs" className="rounded-full border border-ink px-4 py-2.5 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
              {t("home.seeAll")}
            </Link>
          </div>
          <ul className="-mx-3 divide-y divide-line sm:-mx-4">
            {top.map((job) => (
              <li key={job.id}>
                <JobRow job={job} />
              </li>
            ))}
          </ul>
        </section>

        {/* How it works: a real sequence, so it's numbered */}
        <section aria-labelledby="how" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
          <h2 id="how" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            {t("home.howTitle")}
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {copy.steps.map((s, i) => (
              <li key={s.title} className="border-t border-line pt-5">
                <span className="font-display text-5xl font-semibold leading-none text-signal-ink tabular-nums">{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted text-pretty">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why */}
        <section aria-labelledby="why" className="mx-auto mt-24 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <h2 id="why" className="max-w-[12ch] font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
            {t("home.whyTitle")}
          </h2>
          <dl className="divide-y divide-line border-y border-line">
            {copy.why.map((w) => (
              <div key={w.title} className="grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="font-semibold">{w.title}</dt>
                <dd className="text-muted text-pretty">{w.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Companies */}
        <section id="companies" aria-labelledby="companies-h" className="mt-24 scroll-mt-20 bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:items-end md:py-20">
            <div>
              <h2 id="companies-h" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">
                {t("home.companiesTitle")}
              </h2>
              <p className="mt-4 max-w-[52ch] text-lg text-[#c9d2de] text-pretty">{t("home.companiesBody")}</p>
            </div>
            <div className="md:justify-self-end">
              <Link
                href="/signup?as=company"
                className="inline-flex min-h-12 items-center rounded-full bg-paper px-6 font-medium text-ink transition-colors duration-200 hover:bg-white"
              >
                {t("home.companiesCta")}
              </Link>
            </div>
          </div>
        </section>

        {/* Final */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
          <img src="/brand/icon.svg" alt="" width={64} height={64} className="mx-auto" loading="lazy" />
          <h2 className="mx-auto mt-6 max-w-[20ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
            {t("home.finalTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-[48ch] text-lg text-muted text-pretty">{t("home.finalBody")}</p>
          <Link
            href="/jobs"
            className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
          >
            {t("home.finalCta")}
          </Link>
        </section>
      </div>
    </ViewTransition>
  );
}
