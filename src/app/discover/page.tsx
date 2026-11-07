import { Compass, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FitVote } from "@/components/fit-vote";
import { JobRow } from "@/components/job-row";
import { searchJobs } from "@/data/db";
import type { JobLite } from "@/data/types";
import { t } from "@/i18n";
import { coreTitle } from "@/lib/ats";
import type { Verdict } from "@/lib/fit";
import { fitsFor, type ListFit } from "@/lib/fit-list";
import { loadPreferences } from "@/lib/preferences";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Roles worth your time", robots: { index: false } };

const ORDER: Verdict[] = ["strong", "potential", "stretch", "poor", "insufficient"];
const TONE: Record<Verdict, string> = { strong: "text-[#1f7a4d]", potential: "text-[#2c5585]", stretch: "text-signal-ink", poor: "text-[#b4532a]", insufficient: "text-muted" };

export default function DiscoverPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        <Compass aria-hidden="true" className="size-4" />
        {t("discover.eyebrow")}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">
        {t("discover.titleA")} <em className="font-normal text-signal-ink">{t("discover.titleB")}</em>
      </h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t("discover.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Queue({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: asked } = await searchParams;
  const viewer = await requireMember(`/discover${asked ? `?role=${encodeURIComponent(asked)}` : ""}`);
  const p = viewer.profile;
  const current = p.resume.experience.find((e) => e.current) ?? p.resume.experience[0];
  const prefs = await loadPreferences(await createClient(), viewer.id);
  const role = (asked ?? "").trim().slice(0, 80) || prefs.targetRoles[0] || coreTitle(current?.title ?? "") || coreTitle(p.headline);

  const form = (
    <form action="/discover" className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">{t("discover.roleLabel")}</span>
        <input name="role" defaultValue={role} placeholder={t("discover.rolePlaceholder")} maxLength={80} className="h-11 rounded-xl border border-line bg-paper/40 px-3 text-[0.95rem]" />
      </label>
      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
        <Search aria-hidden="true" className="size-4" />
        {t("discover.find")}
      </button>
    </form>
  );

  if (p.resume.experience.length + p.resume.skills.length === 0) {
    return (
      <>
        <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted">
          {t("discover.needProfile")}{" "}
          <Link href="/account/profile" className="font-medium text-ink underline underline-offset-4">
            {t("profile.build")}
          </Link>
        </p>
      </>
    );
  }
  if (!role) return form;

  // Two pages of the best search matches for the role, then ranked by the member's actual fit.
  const q = { q: role, cat: "all" as const, where: "anywhere" as const, remote: false, visa: false, pay: false, level: "any" as const, sort: "match" as const };
  const [a, b] = await Promise.all([searchJobs(q, 1, 40), searchJobs(q, 2, 40)]);
  const jobs: JobLite[] = [...a.jobs, ...b.jobs.filter((j) => !a.jobs.some((x) => x.id === j.id))];
  const fits = await fitsFor(jobs, viewer);
  const ranked = jobs
    .map((job) => ({ job, fit: fits.get(job.id) }))
    .filter((x): x is { job: JobLite; fit: ListFit } => Boolean(x.fit))
    .sort((x, y) => y.fit.score - x.fit.score);

  return (
    <>
      {form}
      {ranked.length === 0 ? (
        <p className="mt-8 text-muted">{t("discover.none", { role })}</p>
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ORDER.map((v) => (
              <li key={v}>
                <a href={`#${v}`} className="flex flex-col rounded-2xl border border-line bg-surface px-4 py-3 hover:border-ink">
                  <span className={`font-display text-3xl font-semibold tabular-nums ${TONE[v]}`}>{ranked.filter((x) => x.fit.verdict === v).length}</span>
                  <span className="text-sm text-muted">{t(`fit.verdict_${v}`)}</span>
                </a>
              </li>
            ))}
          </ul>
          {ORDER.map((v) => {
            const group = ranked.filter((x) => x.fit.verdict === v);
            if (!group.length) return null;
            return (
              <section key={v} id={v} aria-labelledby={`${v}-h`} className="mt-10 scroll-mt-20">
                <h2 id={`${v}-h`} className={`font-display text-2xl font-semibold ${TONE[v]}`}>
                  {t(`fit.verdict_${v}`)} <span className="text-base font-normal text-muted">· {t(`fit.short_${v}`)}</span>
                </h2>
                <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
                  {group.slice(0, v === "poor" ? 8 : 30).map(({ job, fit }) => (
                    <li key={job.id}>
                      <JobRow job={job} fit={fit} />
                      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 px-3 pb-3 sm:px-4">
                        <p className="text-sm text-muted">{reason(fit)}</p>
                        <FitVote jobId={job.id} verdict={fit.verdict} score={fit.score} place="discover" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

/** One line explaining the verdict: what's proven, what carries over, and the main gap. */
function reason(f: ListFit): string {
  return [
    t("fit.listTitle", { strong: f.strong, total: f.total }),
    f.transfer ? t("fit.listTransfer", { what: f.transfer }) : "",
    f.missing ? t("fit.listMissing", { what: f.missing }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
