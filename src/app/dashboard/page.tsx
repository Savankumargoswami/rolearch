import { ArrowRight, CalendarClock, Compass, LayoutDashboard, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { fromRow, funnel, nextStep, nowMs, TRACKER_STATUSES, type TrackedJob } from "@/lib/tracker";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const DAY = 86_400_000;

type Analysis = { id: string; job_key: string; title: string; company: string; score: number; verdict: string; version: string; created_at: string };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        <LayoutDashboard aria-hidden="true" className="size-4" />
        {t("dash.eyebrow")}
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const viewer = await requireMember("/dashboard");
  const db = await createClient();
  const [{ data: rows }, { data: analyses }] = await Promise.all([
    db.from("tracked_jobs").select("*").eq("user_id", viewer.id).order("updated_at", { ascending: false }),
    db.from("job_analyses").select("id,job_key,title,company,score,verdict,version,created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(6),
  ]);
  const jobs = (rows ?? []).map((r) => fromRow(r as Record<string, unknown>));
  const now = nowMs();
  const first = viewer.profile.full_name.trim().split(/\s+/)[0];

  // Next actions: follow-ups, deadlines and other steps, overdue first (blueprint 7.3).
  type Due = { job: TrackedJob; at: number | null; label: string; href?: string; urgent: boolean };
  const due: Due[] = [];
  for (const j of jobs) {
    if (j.status === "archived" || j.status === "withdrawn") continue;
    const step = nextStep(j, now);
    const at = j.followUpOn ? Date.parse(j.followUpOn) : j.status === "saved" || j.status === "ready" ? (j.deadline ? Date.parse(j.deadline) : null) : null;
    if (step) due.push({ job: j, at, label: t(`tracker.next_${step.id}` as MessageKey, step.values), href: step.href, urgent: step.urgent || (at !== null && at < now) });
  }
  due.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.at ?? Infinity) - (b.at ?? Infinity));
  const overdue = due.filter((d) => d.at !== null && d.at < now - DAY).length;

  const interviews = jobs
    .filter((j) => j.interviewAt && Date.parse(j.interviewAt) >= now - 2 * 3600_000)
    .sort((a, b) => Date.parse(a.interviewAt!) - Date.parse(b.interviewAt!))
    .slice(0, 5);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = jobs.filter((j) => j.appliedAt && Date.parse(j.appliedAt) >= monthStart.getTime()).length;
  const counts = TRACKER_STATUSES.map((s) => ({ s, n: jobs.filter((j) => j.status === s).length })).filter((x) => x.n > 0);
  const f = funnel(jobs);
  const applied = jobs.filter((j) => j.appliedAt).map((j) => Date.parse(j.appliedAt!));
  const from = applied.length ? date.format(Math.min(...applied)) : "";
  const to = applied.length ? date.format(Math.max(...applied)) : "";

  return (
    <>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{first ? t("dash.hello", { name: first }) : t("dash.title")}</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/ats" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          <ScanSearch aria-hidden="true" className="size-4" />
          {t("dash.analyze")}
        </Link>
        <Link href="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/25 px-5 font-medium hover:border-ink">
          <Compass aria-hidden="true" className="size-4" />
          {t("dash.discover")}
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("dash.due")} value={due.filter((d) => d.urgent).length} note={overdue ? t("dash.overdue", { n: overdue }) : ""} />
        <Stat label={t("dash.interviews")} value={interviews.length} />
        <Stat label={t("dash.appliedMonth")} value={thisMonth} />
        <Stat label={t("dash.tracked")} value={jobs.length} />
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="next-h" className="rounded-3xl border border-line bg-surface p-5">
          <h2 id="next-h" className="font-display text-xl font-semibold">
            {t("dash.nextTitle")}
          </h2>
          {due.length ? (
            <ul className="mt-3 divide-y divide-line">
              {due.slice(0, 8).map((d) => (
                <li key={d.job.jobId} className="flex items-start gap-3 py-3 text-sm">
                  <CalendarClock aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${d.urgent ? "text-signal-ink" : "text-muted"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {d.job.title} · <span className="font-normal text-muted">{d.job.company}</span>
                    </span>
                    {d.href ? (
                      <Link href={d.href} className="underline underline-offset-4">
                        {d.label}
                      </Link>
                    ) : (
                      <span>{d.label}</span>
                    )}
                  </span>
                  {d.at !== null && <span className={`shrink-0 text-xs tabular-nums ${d.at < now ? "font-semibold text-[#b4532a]" : "text-muted"}`}>{date.format(d.at)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("dash.nothingDue")}</p>
          )}
          <Link href="/tracker" className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
            {t("dash.openTracker")}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="int-h" className="rounded-3xl border border-line bg-surface p-5">
            <h2 id="int-h" className="font-display text-xl font-semibold">
              {t("dash.interviewsTitle")}
            </h2>
            {interviews.length ? (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {interviews.map((j) => (
                  <li key={j.jobId}>
                    <span className="block font-medium">{j.title}</span>
                    <span className="text-muted">
                      {j.company} · {dateTime.format(new Date(j.interviewAt!))}
                    </span>{" "}
                    <Link href={`/interview?job=${encodeURIComponent(j.jobId)}`} className="underline underline-offset-4">
                      {t("dash.prepare")}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("dash.noInterviews")}</p>
            )}
          </section>

          <section aria-labelledby="st-h" className="rounded-3xl border border-line bg-surface p-5">
            <h2 id="st-h" className="font-display text-xl font-semibold">
              {t("dash.byStatus")}
            </h2>
            {counts.length ? (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {counts.map(({ s, n }) => (
                  <li key={s}>
                    <Link href={`/tracker?status=${s}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line px-3 hover:border-ink">
                      {t(`tracker.s_${s}` as MessageKey)}
                      <span className="rounded-full bg-ink-soft px-2 tabular-nums">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("tracker.empty")}</p>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="an-h" className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 id="an-h" className="font-display text-xl font-semibold">
          {t("dash.analysesTitle")}
        </h2>
        {(analyses ?? []).length ? (
          <ul className="mt-2 divide-y divide-line">
            {(analyses as Analysis[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{a.title || t("dash.untitled")}</span>
                  <span className="text-muted">
                    {[a.company, dateTime.format(new Date(a.created_at)), a.version].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-ink-soft px-2.5 py-0.5 text-xs font-semibold">
                    {t(`fit.verdict_${a.verdict}` as MessageKey)}
                    {a.verdict !== "insufficient" && ` · ${a.score}`}
                  </span>
                  {!a.job_key.startsWith("pasted-") && (
                    <Link href={`/jobs/${a.job_key}#ats-h`} className="underline underline-offset-4">
                      {t("dash.reopen")}
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("dash.noAnalyses")}</p>
        )}
      </section>

      <section aria-labelledby="out-h" className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 id="out-h" className="font-display text-xl font-semibold">
          {t("dash.outcomesTitle")}
        </h2>
        {f.applied >= 3 ? (
          <p className="mt-2 text-sm">
            {t("dash.outcomesLine", { sent: f.applied, interviews: f.interviewing, offers: f.offer, rate: f.interviewRate, from, to })}{" "}
            <Link href="/tracker" className="underline underline-offset-4">
              {t("dash.outcomesMore")}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("dash.outcomesSmall", { n: f.applied })}</p>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-xs font-semibold text-[#b4532a]">{note}</dd>}
    </div>
  );
}
