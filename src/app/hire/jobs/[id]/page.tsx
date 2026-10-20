import { ArrowLeft, ArrowUpRight, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { t, type MessageKey } from "@/i18n";
import { count, postedAgo } from "@/lib/format";
import { FUNNEL, STAGES, applicationsFor, companyJob, daysSince, events, jobStats, viewsFor, type ApplicationRow, type JobStats } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "../../company-gate";
import { JobStatusButton, StageMenu } from "../../pipeline-controls";

export const metadata: Metadata = { title: "Manage job", robots: { index: false } };

export default function ManageJobPage({ params, searchParams }: PageProps<"/hire/jobs/[id]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Manage params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Manage({ params, searchParams }: { params: PageProps<"/hire/jobs/[id]">["params"]; searchParams: PageProps<"/hire/jobs/[id]">["searchParams"] }) {
  const { id } = await params;
  const posted = (await searchParams).posted === "1";
  const viewer = await requireMember(`/hire/jobs/${id}`);
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  const db = await createClient();
  const job = await companyJob(db, viewer.id, id);
  if (!job) notFound();
  const [apps, views] = await Promise.all([applicationsFor(db, viewer.id, [id]), viewsFor(db, [id])]);
  const history = await events(db, apps.map((a) => a.id));
  const stats = jobStats(apps, views, history);
  const days = daysSince(job.postedAt);

  return (
    <>
      <Link href="/hire" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("hire.dashboardTitle")}
      </Link>
      {posted && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-signal/20 p-3 font-medium">
          <CircleCheck aria-hidden="true" className="size-5" />
          {t("hire.published")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{job.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${job.status === "open" ? "bg-signal/25 text-ink" : "bg-ink-soft"}`}>
              {job.status === "open" ? t("hire.open") : t("hire.closed")}
            </span>
            {[job.city, job.country].filter(Boolean).join(", ")} · {t("hire.posted", { ago: postedAgo(days) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === "open" && (
            <Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 hover:border-ink">
              {t("hire.viewPublic")}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          )}
          <JobStatusButton jobId={job.id} status={job.status} />
        </div>
      </div>

      <Analytics stats={stats} />

      <section aria-labelledby="pipeline-h" className="mt-12">
        <h2 id="pipeline-h" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
          {t("hire.pipelineTitle")}
        </h2>
        {apps.length === 0 ? (
          <p className="mt-6 text-muted">{t("hire.pipelineEmpty")}</p>
        ) : (
          <Board apps={apps} />
        )}
      </section>
    </>
  );
}

function Analytics({ stats }: { stats: JobStats }) {
  const tiles = [
    { label: t("hire.statViews"), value: count(stats.views) },
    { label: t("hire.statApplicants"), value: count(stats.applicants) },
    { label: t("hire.statRate"), value: stats.applyRate == null ? t("hire.none") : `${stats.applyRate}%` },
    { label: t("hire.statFirst"), value: stats.medianDaysToFirstAction == null ? t("hire.none") : t("hire.days", { n: stats.medianDaysToFirstAction }) },
    { label: t("hire.statHire"), value: stats.medianDaysToHire == null ? t("hire.none") : t("hire.days", { n: stats.medianDaysToHire }) },
  ];
  const top = Math.max(1, ...stats.daily.map((d) => Math.max(d.views, d.applicants)));
  const funnelTop = Math.max(1, stats.reached.new);
  const verdicts = [
    { key: "strong", label: t("verdict.strong"), n: stats.byVerdict.strong, color: "bg-[#2f7d5b]" },
    { key: "partial", label: t("verdict.partial"), n: stats.byVerdict.partial, color: "bg-[#c79a2b]" },
    { key: "weak", label: t("verdict.weak"), n: stats.byVerdict.weak, color: "bg-[#b4532a]" },
  ];
  const verdictTotal = Math.max(1, verdicts.reduce((s, v) => s + v.n, 0));

  return (
    <section aria-labelledby="perf-h" className="mt-10">
      <h2 id="perf-h" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
        {t("hire.analyticsTitle")}
      </h2>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{x.label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <figure className="rounded-2xl border border-line bg-surface p-5">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{t("hire.last14")}</span>
            <span className="flex gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-sm bg-ink/25" />{t("hire.legendViews")}</span>
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-sm bg-ink" />{t("hire.legendApplicants")}</span>
            </span>
          </figcaption>
          <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label={stats.daily.map((d) => `${d.day}: ${d.views} ${t("hire.legendViews")}, ${d.applicants} ${t("hire.legendApplicants")}`).join("; ")}>
            {stats.daily.map((d) => (
              <div key={d.day} className="relative flex h-full flex-1 items-end" title={`${d.day} · ${d.views} / ${d.applicants}`}>
                <div className="w-full rounded-t-sm bg-ink/20" style={{ height: `${(d.views / top) * 100}%` }} />
                <div className="absolute inset-x-1 bottom-0 rounded-t-sm bg-ink" style={{ height: `${(d.applicants / top) * 100}%` }} />
              </div>
            ))}
          </div>
        </figure>

        <figure className="rounded-2xl border border-line bg-surface p-5">
          <figcaption>
            <span className="font-medium">{t("hire.funnelTitle")}</span>
            <span className="block text-xs text-muted">{t("hire.funnelHint")}</span>
          </figcaption>
          <ul className="mt-3 flex flex-col gap-2">
            {FUNNEL.map((s) => (
              <li key={s} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                <span>{t(`hire.st_${s}` as MessageKey)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-ink-soft">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${(stats.reached[s] / funnelTop) * 100}%` }} />
                </span>
                <span className="text-end tabular-nums">{stats.reached[s]}</span>
              </li>
            ))}
          </ul>
        </figure>

        <figure className="rounded-2xl border border-line bg-surface p-5">
          <figcaption className="font-medium">{t("hire.matchTitle")}</figcaption>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-ink-soft" aria-hidden="true">
            {verdicts.map((v) => (
              <span key={v.key} className={v.color} style={{ width: `${(v.n / verdictTotal) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {verdicts.map((v) => (
              <li key={v.key} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`size-2.5 rounded-full ${v.color}`} />{v.label}</span>
                <span className="tabular-nums">{v.n}</span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}

function Board({ apps }: { apps: ApplicationRow[] }) {
  const columns = [...STAGES, "withdrawn" as const].map((s) => ({
    stage: s,
    items: apps.filter((a) => a.stage === s).sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1)),
  }));
  return (
    <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
      {columns
        .filter((c) => c.stage !== "withdrawn" || c.items.length > 0)
        .map((c) => (
          <section key={c.stage} aria-label={t(`hire.st_${c.stage}` as MessageKey)} className="flex w-72 shrink-0 flex-col rounded-2xl bg-ink-soft/60 p-3">
            <h3 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold">
              {t(`hire.st_${c.stage}` as MessageKey)}
              <span className="rounded-full bg-surface px-2 text-xs tabular-nums">{c.items.length}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {c.items.map((a) => {
                const days = daysSince(a.createdAt);
                return (
                  <li key={a.id} className="rounded-xl border border-line bg-surface p-3">
                    <Link href={`/hire/applications/${a.id}`} className="flex items-start gap-3 rounded-lg hover:underline">
                      <Avatar url={a.snapshot.avatar} name={a.snapshot.name} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.snapshot.name}</span>
                        <span className="block truncate text-sm text-muted">{a.snapshot.headline}</span>
                      </span>
                    </Link>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      {a.matchScore != null && <span className="font-medium text-ink">{t("hire.match", { n: a.matchScore })}</span>}
                      {a.atsScore != null && <span>{t("hire.ats", { n: a.atsScore })}</span>}
                      <span>{t("hire.applied", { ago: postedAgo(days) })}</span>
                    </p>
                    {a.stage !== "withdrawn" && <StageMenu appId={a.id} stage={a.stage} compact />}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
