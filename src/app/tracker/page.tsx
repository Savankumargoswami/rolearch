import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { events, myApplications } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { TRACKER_STATUSES, type TrackedJob, type TrackerStatus } from "@/lib/tracker";
import { TrackerItem } from "./tracker-item";

export const metadata: Metadata = { title: "Job tracker", robots: { index: false } };

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("tracker.title")}</h1>
      <p className="mt-2 text-muted">{t("tracker.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Tracker />
      </Suspense>
    </div>
  );
}

async function Tracker() {
  const viewer = await requireMember("/tracker");
  const db = await createClient();
  const [{ data }, apps] = await Promise.all([
    db.from("tracked_jobs").select("job_id,status,title,company,url,notes,applied_at,updated_at,created_at").eq("user_id", viewer.id).order("updated_at", { ascending: false }),
    myApplications(db, viewer.id),
  ]);
  const tracked: TrackedJob[] = (data ?? []).map((r) => ({
    jobId: r.job_id,
    status: r.status as TrackerStatus,
    title: r.title,
    company: r.company,
    url: r.url,
    notes: r.notes,
    appliedAt: r.applied_at,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  }));
  const appByJob = new Map(apps.map((a) => [a.jobId, a]));
  const history = await events(db, apps.map((a) => a.id));

  if (!tracked.length) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="text-muted">{t("tracker.empty")}</p>
        <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          <Search aria-hidden="true" className="size-4" />
          {t("tracker.findJobs")}
        </Link>
      </div>
    );
  }

  const counts = Object.fromEntries(TRACKER_STATUSES.map((s) => [s, tracked.filter((j) => j.status === s).length]));
  return (
    <>
      <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("tracker.status")}>
        {TRACKER_STATUSES.filter((s) => counts[s] > 0).map((s) => (
          <li key={s}>
            <a href={`#${s}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm hover:border-ink">
              {t(`tracker.s_${s}` as MessageKey)}
              <span className="rounded-full bg-ink-soft px-2 tabular-nums">{counts[s]}</span>
            </a>
          </li>
        ))}
      </ul>
      {TRACKER_STATUSES.filter((s) => counts[s] > 0).map((s) => (
        <section key={s} id={s} aria-labelledby={`${s}-h`} className="mt-10 scroll-mt-20">
          <h2 id={`${s}-h`} className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
            {t(`tracker.s_${s}` as MessageKey)}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {tracked
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
                    <TrackerItem job={j} application={app ? { id: app.id, stage: app.stage } : null} messages={msgs} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}
