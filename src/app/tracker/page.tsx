import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { events, myApplications } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { fromRow, funnel, nextStep, nowMs, TRACKER_STATUSES } from "@/lib/tracker";
import { outcomes, type Rate } from "@/lib/outcomes";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { TrackerItem } from "./tracker-item";

export const metadata: Metadata = { title: "Job tracker", robots: { index: false } };

type Search = Promise<{ view?: string; q?: string; status?: string; period?: string }>;

export default function TrackerPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Tracker searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <FeedbackPrompt />
      </Suspense>
    </div>
  );
}

async function Tracker({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";
  const query = String(sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const only = (TRACKER_STATUSES as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "";
  const allTime = sp.period === "all";
  const viewer = await requireMember("/tracker");
  const db = await createClient();
  const [{ data }, apps] = await Promise.all([
    // "*" so the page works before and after db/031 adds the application manager's columns.
    db.from("tracked_jobs").select("*").eq("user_id", viewer.id).order("updated_at", { ascending: false }),
    myApplications(db, viewer.id),
  ]);
  const tracked = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
  const now = nowMs();
  // Which resume version went to which job (db/032), for outcome intelligence.
  const versionOf = new Map<string, string>();
  for (const r of (data ?? []) as Record<string, unknown>[]) if (typeof r.resume_version === "string") versionOf.set(String(r.job_id), r.resume_version);
  const { data: versions } = versionOf.size ? await db.from("resume_versions").select("id,label").eq("user_id", viewer.id) : { data: [] };
  const labels = new Map((versions ?? []).map((v: { id: string; label: string }) => [v.id, v.label]));
  const appByJob = new Map(apps.map((a) => [a.jobId, a]));
  const history = await events(db, apps.map((a) => a.id));
  // Recruiter views of applications sent through Rolearch (db/036; empty before it runs).
  const { data: viewRows } = await db.rpc("my_application_views").then(
    (r) => r,
    () => ({ data: null }),
  );
  const viewed = new Set(((viewRows ?? []) as { job_id: string }[]).map((r) => r.job_id));
  const heading = (
    <>
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("tracker.managerTitle")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("tracker.title")}</h1>
      <p className="mt-2 text-muted">{t("tracker.managerLead")}</p>
    </>
  );

  if (!tracked.length) {
    return (
      <>
      {heading}
      <div className="mt-10 rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="text-muted">{t("tracker.empty")}</p>
        <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          <Search aria-hidden="true" className="size-4" />
          {t("tracker.findJobs")}
        </Link>
      </div>
      </>
    );
  }

  const shown = tracked.filter(
    (j) => (!only || j.status === only) && (!query || `${j.title} ${j.company} ${j.notes} ${j.contactName}`.toLowerCase().includes(query)),
  );
  // Your Application Funnel: the last 30 days by default, or all time.
  const cutoff = now - 30 * 86_400_000;
  const inPeriod = allTime ? tracked : tracked.filter((j) => Date.parse(j.appliedAt ?? j.updatedAt) >= cutoff);
  const f = funnel(inPeriod, viewed);
  const steps = [
    { n: f.applied, label: t("tracker.funnelApplied"), of: false },
    { n: f.views, label: t("tracker.funnelViews"), of: true },
    { n: f.responses, label: t("tracker.funnelResponses"), of: true },
    { n: f.interviewing, label: t("tracker.funnelInterviews"), of: true },
    { n: f.offer, label: t("tracker.funnelOffers"), of: true },
  ];
  const periodHref = (all: boolean) => {
    const q = new URLSearchParams();
    if (view === "board") q.set("view", "board");
    if (query) q.set("q", query);
    if (only) q.set("status", only);
    if (all) q.set("period", "all");
    const s = q.toString();
    return `/tracker${s ? `?${s}` : ""}#funnel-h`;
  };
  const top = Math.max(1, ...steps.map((x) => x.n));
  const o = f.applied >= 3 ? await outcomes(tracked, labels, versionOf) : null;
  return (
    <>
      {heading}
      <section aria-labelledby="funnel-h" className="mt-6 grid gap-5 rounded-3xl bg-ink p-5 text-paper sm:p-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 id="funnel-h" className="font-display text-lg font-semibold">{t("tracker.funnelTitle")}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-[#c9d2de]">
            <span>{allTime ? t("tracker.funnelAll") : t("tracker.funnel30")}</span>
            <span aria-hidden="true">·</span>
            <span>{t("tracker.funnelAcross")}</span>
            <Link href={periodHref(!allTime)} className="ms-auto font-medium text-signal underline underline-offset-4">
              {allTime ? t("tracker.funnelShow30") : t("tracker.funnelShowAll")}
            </Link>
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {steps.map((x) => (
              <li key={x.label} className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-3 text-sm">
                <span className="text-[#c9d2de]">{x.label}</span>
                <span className="h-7 overflow-hidden rounded-lg bg-white/10">
                  <span className="grow-x flex h-full min-w-8 items-center rounded-lg bg-signal px-2 font-semibold text-ink tabular-nums" style={{ width: `${Math.max(8, (x.n / top) * 100)}%` }}>
                    {x.n}
                  </span>
                </span>
                <span className="text-end text-xs text-[#c9d2de] tabular-nums">{x.of && f.applied > 0 ? `${Math.round((x.n / f.applied) * 100)}%` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#9fb0c3]">{t("tracker.funnelViewsNote")}</p>
          {f.applied > 0 && (
            <p className="mt-3 text-sm text-[#dfe5ec]">
              {t("tracker.interviewRate", { n: f.interviewRate })} · {t("tracker.offerRate", { n: f.offerRate })}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-white/[0.06] p-4">
          <h3 className="font-display font-semibold">{t("tracker.reasonsTitle")}</h3>
          {f.reasons.length ? (
            <>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {f.reasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span>{t(`tracker.reason_${r.reason}` as MessageKey)}</span>
                    <span className="tabular-nums text-[#c9d2de]">{r.n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-signal">{t(`tracker.reasonsAdvice_${f.reasons[0].reason}` as MessageKey)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#c9d2de]">{t("tracker.reasonsNone")}</p>
          )}
        </div>
      </section>
      {o ? (
        <section aria-labelledby="outcomes-h" className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="outcomes-h" className="font-display text-lg font-semibold">
            {t("outcomes.title")}
          </h2>
          <p className="text-sm text-muted">{t("outcomes.lead")}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "sent", n: o.sent },
              { k: "responses", n: o.responses },
              { k: "interviews", n: o.interviews },
              { k: "offers", n: o.offers },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-ink-soft/60 p-3">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t(`outcomes.${x.k}` as MessageKey)}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">
                  {x.n}
                  {x.k !== "sent" && o.sent > 0 && <span className="ms-1 text-sm font-normal text-muted">{Math.round((x.n / o.sent) * 100)}%</span>}
                </dd>
              </div>
            ))}
          </dl>
          <PlatformChart rows={o.byPlatform} />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <RateTable title={t("outcomes.byVersion")} rows={o.byVersion} label={(k) => k} />
            <RateTable title={t("outcomes.byCategory")} rows={o.byCategory} label={(k) => t(`categories.${k}` as MessageKey)} />
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="font-medium">{t("outcomes.stopsTitle")}</h3>
              <ul className="mt-1 text-sm">
                <li>{t("outcomes.stopNoResponse", { n: o.stops.noResponse })}</li>
                <li>{t("outcomes.stopBefore", { n: o.stops.beforeInterview })}</li>
                <li>{t("outcomes.stopAfter", { n: o.stops.afterInterview })}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium">{t("outcomes.skillsTitle")}</h3>
              <p className="mt-1 text-sm text-muted">{o.winningSkills.length ? o.winningSkills.join(", ") : t("outcomes.skillsNone")}</p>
            </div>
          </div>
        </section>
      ) : (
        f.applied > 0 && <p className="mt-4 text-sm text-muted">{t("outcomes.notYet")}</p>
      )}
      {/* Search, status filter, list or board, and CSV export (blueprint 2.2 F, 7.4). */}
      <form action="/tracker" className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-end">
        <input type="hidden" name="view" value={view} />
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{t("tracker.search")}</span>
          <input name="q" defaultValue={query} placeholder={t("tracker.searchPlaceholder")} maxLength={80} className="h-10 rounded-lg border border-line bg-paper/40 px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-48">
          <span className="font-medium">{t("tracker.status")}</span>
          <select name="status" defaultValue={only} className="h-10 rounded-lg border border-line bg-surface px-2">
            <option value="">{t("tracker.allStatuses")}</option>
            {TRACKER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`tracker.s_${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 cursor-pointer rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-hover">
          {t("tracker.apply")}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-ink-soft p-1 text-sm" role="group" aria-label={t("tracker.viewLabel")}>
          {(["list", "board"] as const).map((v) => (
            <Link
              key={v}
              href={`/tracker?view=${v}${query ? `&q=${encodeURIComponent(query)}` : ""}${only ? `&status=${only}` : ""}`}
              aria-current={view === v ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-4 font-medium ${view === v ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {t(v === "list" ? "tracker.viewList" : "tracker.viewBoard")}
            </Link>
          ))}
        </div>
        <a href="/tracker/export" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium hover:border-ink">
          {t("tracker.exportCsv")}
        </a>
      </div>

      {view === "board" ? (
        <div className="rail -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {TRACKER_STATUSES.filter((s) => !only || s === only).map((s) => {
            const col = shown.filter((j) => j.status === s);
            return (
              <section key={s} aria-labelledby={`b-${s}`} className="flex w-64 shrink-0 flex-col rounded-2xl bg-ink-soft/60 p-3">
                <h2 id={`b-${s}`} className="flex items-center justify-between text-sm font-semibold">
                  {t(`tracker.s_${s}` as MessageKey)}
                  <span className="rounded-full bg-surface px-2 tabular-nums">{col.length}</span>
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {col.map((j) => {
                    const step = nextStep(j, now);
                    return (
                      <li key={j.jobId} className="rounded-xl border border-line bg-surface p-3 text-sm">
                        <Link href={`/tracker?q=${encodeURIComponent(j.title.toLowerCase())}`} className="font-medium hover:underline">
                          {j.title}
                        </Link>
                        <p className="text-muted">{j.company}</p>
                        {step && <p className={`mt-1 text-xs ${step.urgent ? "text-signal-ink" : "text-muted"}`}>{t(`tracker.next_${step.id}` as MessageKey, step.values)}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
      <>
      {shown.length === 0 && <p className="mt-8 text-muted">{t("tracker.noMatches")}</p>}
      {TRACKER_STATUSES.filter((s) => shown.some((j) => j.status === s)).map((s) => (
        <section key={s} id={s} aria-labelledby={`${s}-h`} className="mt-10 scroll-mt-20">
          <h2 id={`${s}-h`} className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
            {t(`tracker.s_${s}` as MessageKey)}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {shown
              .filter((j) => j.status === s)
              .map((j) => {
                const app = appByJob.get(j.jobId);
                const msgs = app
                  ? (history.get(app.id) ?? [])
                      .filter((e) => e.kind === "message" || (e.kind === "stage" && e.body))
                      .map((e) => ({ body: e.body, at: e.createdAt }))
                  : [];
                return (
                  <li key={j.jobId}>
                    <TrackerItem job={j} application={app ? { id: app.id, stage: app.stage } : null} messages={msgs} step={nextStep(j, now)} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      </>
      )}
    </>
  );
}

/** Interview rate by hiring platform, as columns (highest first). */
function PlatformChart({ rows }: { rows: Rate[] }) {
  const data = rows
    .filter((r) => r.sent > 0)
    .map((r) => ({ ...r, pct: Math.round((r.interviews / r.sent) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct || b.sent - a.sent)
    .slice(0, 8);
  const top = Math.max(1, ...data.map((d) => d.pct));
  return (
    <div className="mt-5 rounded-2xl bg-ink p-4 text-paper sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{t("outcomes.byPlatform")}</h3>
        <span className="text-xs text-[#c9d2de]">{t("outcomes.higherBetter")}</span>
      </div>
      {data.length ? (
        <ul className="mt-4 flex h-44 items-end gap-2 sm:gap-4" aria-label={t("outcomes.byPlatform")}>
          {data.map((d) => (
            <li key={d.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold tabular-nums">{d.pct}%</span>
              <span
                className="w-full max-w-14 rounded-t-md bg-signal"
                style={{ height: `${Math.max(4, (d.pct / top) * 100)}%` }}
                title={t("outcomes.rateLine", { interviews: d.interviews, sent: d.sent, pct: Math.round(d.pct) })}
              />
              <span className="w-full truncate text-center text-[0.65rem] font-semibold tracking-[0.08em] text-[#c9d2de] uppercase">{d.key}</span>
              <span className="text-[0.65rem] text-[#c9d2de] tabular-nums">{t("outcomes.sentN", { n: d.sent })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[#c9d2de]">{t("outcomes.none")}</p>
      )}
    </div>
  );
}

/** Responses and interviews per group (resume version, job category, platform), as counts and rates. */
function RateTable({ title, rows, label }: { title: string; rows: Rate[]; label: (key: string) => string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {rows.length ? (
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{label(r.key)}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {t("outcomes.rateLine", { interviews: r.interviews, sent: r.sent, pct: Math.round((r.interviews / r.sent) * 100) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{t("outcomes.none")}</p>
      )}
    </div>
  );
}
