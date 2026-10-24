import { ArrowRight, Check, ScanSearch } from "lucide-react";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { HeroSearch } from "@/components/hero-search";
import { JobRow } from "@/components/job-row";
import { MeridianMap } from "@/components/meridian-map";
import { getJobFeed, jobMap } from "@/data/db";
import type { JobLite } from "@/data/types";
import { m, t } from "@/i18n";
import { count } from "@/lib/format";
import { loadViewer } from "@/lib/profile";
import { filterJobs, emptyFilters } from "@/lib/search";

const quick = [
  { label: "Software engineer", href: "/jobs?q=software+engineer" },
  { label: "Nurse", href: "/jobs?cat=healthcare" },
  { label: "Truck driver", href: "/jobs?cat=driving" },
  { label: "Warehouse", href: "/jobs?cat=logistics" },
  { label: "Remote", href: "/jobs?where=remote" },
  { label: "Visa sponsorship", href: "/jobs?visa=1" },
  { label: "Entry level", href: "/jobs?level=entry" },
];

const pageTransition = {
  enter: { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" },
  exit: { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" },
} as const;

export default async function Home() {
  const [feed, pins] = await Promise.all([getJobFeed(), jobMap()]);
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
            <Link
              href="/ats"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-signal bg-signal/15 px-4 text-sm font-medium transition-colors duration-200 hover:bg-signal/30"
            >
              <span className="rounded-full bg-signal px-2 py-0.5 text-xs font-semibold">{t("home.atsHeroTag")}</span>
              {t("home.atsHero")}
              <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </Link>
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
            <MeridianMap pins={pins} />
          </div>
        </section>

        {/* Free ATS check: the front door. Anyone can start a scan; the result comes with a free account. */}
        <section aria-labelledby="ats-home" className="mt-20 bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-signal px-3 py-1 text-sm font-semibold text-ink">
                <ScanSearch aria-hidden="true" className="size-4" />
                {t("home.atsKicker")}
              </p>
              <h2 id="ats-home" className="mt-5 max-w-[16ch] font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
                {t("home.atsTitle")}
              </h2>
              <p className="mt-5 max-w-[50ch] text-lg text-[#c9d2de] text-pretty">{t("home.atsBody")}</p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {copy.atsPoints.map((p) => (
                  <li key={p.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-signal text-ink">
                      <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    </span>
                    <span>
                      <span className="block font-semibold">{p.title}</span>
                      <span className="block text-sm text-[#c9d2de]">{p.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href="/ats"
                  className="inline-flex min-h-14 items-center gap-2 rounded-full bg-signal px-7 text-lg font-semibold text-ink shadow-[0_8px_30px_rgba(217,163,91,0.35)] transition-colors duration-200 hover:bg-[#ebb877]"
                >
                  {t("home.atsCta")}
                  <ArrowRight aria-hidden="true" className="size-5 rtl:-scale-x-100" />
                </Link>
                <Link href="/tracker" className="font-medium text-[#dfe5ec] underline decoration-[#dfe5ec]/40 underline-offset-4 hover:text-paper">
                  {t("home.atsTracker")}
                </Link>
              </div>
              <p className="mt-4 text-sm text-[#9fb0c3]">{t("home.atsFine")}</p>
            </div>

            {/* Example before/after, so visitors see what they get */}
            <div className="rounded-3xl bg-paper p-5 text-ink shadow-2xl sm:p-7">
              <p className="text-sm text-muted">{copy.atsSample.label}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-ink-soft p-4">
                  <p className="text-sm font-medium text-muted">{t("home.atsBefore")}</p>
                  <p className="mt-1 font-display text-6xl font-semibold leading-none tabular-nums text-[#b4532a]">54</p>
                </div>
                <div className="rounded-2xl bg-signal/25 p-4">
                  <p className="text-sm font-medium text-muted">{t("home.atsAfter")}</p>
                  <p className="mt-1 font-display text-6xl font-semibold leading-none tabular-nums">87</p>
                </div>
              </div>
              <dl className="mt-6 space-y-3">
                {copy.atsSample.parts.map((p) => (
                  <div key={p.name} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <dt>{p.name}</dt>
                    <dd aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-soft">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${p.score}%` }} />
                    </dd>
                    <dd className="text-end tabular-nums text-muted">{p.score}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-sm font-medium">{copy.atsSample.missing}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {copy.atsSample.keywords.map((k) => (
                  <li key={k} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-sm text-paper">
                    <Check aria-hidden="true" className="size-3.5" />
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Fresh jobs */}
        <section aria-labelledby="fresh" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
            <div>
              <h2 id="fresh" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                {t("home.freshTitle")}
              </h2>
              <p className="mt-2 max-w-[60ch] text-muted">{t("home.freshLead", { n: count(feed.total), k: feed.companies, c: feed.countries })}</p>
            </div>
            <Link href="/jobs" className="rounded-full border border-ink px-4 py-2.5 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
              {t("home.seeAll")}
            </Link>
          </div>
          <Suspense fallback={<JoinToSee n={feed.total} />}>
            <FreshJobs jobs={top} total={feed.total} />
          </Suspense>
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

        {/* Job tracker: members get it in the header; visitors learn about it here */}
        <section aria-labelledby="tracker-h" className="mx-auto mt-24 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 id="tracker-h" className="max-w-[14ch] font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
              {t("home.trackerTitle")}
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg text-muted text-pretty">{t("home.trackerBody")}</p>
            <Link
              href="/tracker"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
            >
              {t("home.trackerCta")}
            </Link>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
            <ol aria-label={t("home.trackerFlowLabel")} className="flex flex-wrap items-center gap-2 text-sm">
              {(["saved", "applied", "interviewing", "offer"] as const).map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className="text-muted">→</span>}
                  <span className={`rounded-full px-3 py-1.5 font-medium ${i === 3 ? "bg-signal/30" : "bg-ink-soft"}`}>{t(`tracker.s_${s}`)}</span>
                </li>
              ))}
            </ol>
            <dl className="mt-6 divide-y divide-line border-t border-line">
              {copy.trackerPoints.map((p) => (
                <div key={p.title} className="py-4">
                  <dt className="font-semibold">{p.title}</dt>
                  <dd className="mt-1 text-muted text-pretty">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>
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

/** Members see the newest jobs; visitors see how many are waiting and a sign-up button. */
async function FreshJobs({ jobs, total }: { jobs: JobLite[]; total: number }) {
  if (!(await loadViewer())) return <JoinToSee n={total} />;
  return (
    <ul className="-mx-3 divide-y divide-line sm:-mx-4">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobRow job={job} />
        </li>
      ))}
    </ul>
  );
}

function JoinToSee({ n }: { n: number }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-4 rounded-3xl bg-ink p-6 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <p className="font-display text-2xl font-semibold">{t("home.joinTitle", { n: count(n) })}</p>
        <p className="mt-1 text-[#c9d2de]">{t("home.joinBody")}</p>
      </div>
      <Link href="/signup?next=/jobs" className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-signal px-6 font-medium text-ink transition-colors duration-200 hover:bg-[#ebb877]">
        {t("nav.signUp")}
      </Link>
    </div>
  );
}
