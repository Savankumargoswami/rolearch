import { ArrowUpRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompanyBar } from "@/components/company-bar";
import { t } from "@/i18n";
import { count, postedAgo } from "@/lib/format";
import { applicationsFor, companyJobs, daysSince, events, overview, STRONG, viewsFor, WAITING_DAYS } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "./company-gate";
import { FeedPanel, type FeedRow } from "./feed-panel";

export const metadata: Metadata = { title: "Hiring dashboard", robots: { index: false } };

type Search = Promise<{ range?: string }>;

export default function HirePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const STAGE_LABEL = { new: "Applied", screening: "Screened", interview: "Interviewed", offer: "Offer made", hired: "Hired" } as const;

async function Dashboard({ searchParams }: { searchParams: Search }) {
  const viewer = await requireMember("/hire");
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  const range = (await searchParams).range === "90" ? 90 : 30;
  const db = await createClient();
  const jobs = await companyJobs(db, viewer.id);
  const ids = jobs.map((j) => j.id);
  const [apps, views, { data: feedRows }] = await Promise.all([
    applicationsFor(db, viewer.id, ids),
    viewsFor(db, ids),
    db.from("employer_feeds").select("id, url, status, job_count, last_error, last_checked_at").order("created_at"),
  ]);
  const history = await events(db, apps.map((a) => a.id));
  const o = overview(apps, history, views, range);
  const feeds: FeedRow[] = (feedRows ?? []).map((f) => ({
    id: f.id,
    url: f.url,
    status: f.status,
    jobCount: f.job_count,
    lastError: f.last_error,
    checkedAgo: f.last_checked_at ? postedAgo(daysSince(f.last_checked_at)) : null,
  }));
  const open = jobs.filter((j) => j.status === "open").length;
  const pct = (n: number) => (o.applicants ? `${Math.round((n / o.applicants) * 100)}% of applicants` : "no applicants yet");
  const kpis = [
    { label: "Open jobs", value: count(open), note: jobs.length - open ? `${jobs.length - open} closed` : "all live" },
    { label: "Applicants", value: count(o.applicants), note: `last ${range} days` },
    { label: "Avg. verified match", value: o.avgMatch === null ? "–" : `${o.avgMatch}%`, note: `${o.strong} strong matches (${STRONG}%+)` },
    { label: "Median first reply", value: o.medianFirstReply === null ? "–" : `${o.medianFirstReply} d`, note: "Rolearch flags 21+ days" },
    { label: "Interviews", value: count(o.interviews), note: pct(o.interviews) },
    { label: "Offers accepted", value: o.offers ? `${o.hired} of ${o.offers}` : "–", note: o.offers ? `${Math.round((o.hired / o.offers) * 100)}% acceptance` : "no offers yet" },
  ];
  const top = Math.max(1, o.funnel[0]?.n ?? 0);
  const maxWeek = Math.max(1, ...o.weekly);

  return (
    <>
      <CompanyBar name={viewer.companyName} website={viewer.website} verified={viewer.companyDomainMatches} current="dashboard" />
      {!viewer.companyDomainMatches && <CompanyGate kind="unverified" site={viewer.website} />}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.025em]">Hiring dashboard</h1>
          <p className="mt-1 text-muted">Jobs you posted on Rolearch and the people who applied here.</p>
        </div>
        <div role="group" aria-label="Time range" className="inline-flex rounded-full border border-line bg-surface p-1">
          {[30, 90].map((r) => (
            <Link
              key={r}
              href={r === 30 ? "/hire" : "/hire?range=90"}
              aria-current={range === r ? "true" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium ${range === r ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
            >
              Last {r} days
            </Link>
          ))}
        </div>
      </div>

      {o.waiting.length > 0 && (
        <div role="note" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E3B86B] bg-[#FDF3E3] p-4">
          <p className="flex items-start gap-2 text-sm text-[#7A4708]">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>
                {o.waiting.length} {o.waiting.length === 1 ? "applicant has" : "applicants have"} waited {WAITING_DAYS}+ days with no reply.
              </b>{" "}
              Reply before day 21 so your jobs don&apos;t get a &ldquo;Slow to respond&rdquo; label.
            </span>
          </p>
          <Link href="/hire/candidates?waiting=1" className="inline-flex min-h-10 items-center rounded-full bg-[#7A4708] px-4 text-sm font-medium text-white hover:opacity-90">
            Show them
          </Link>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{k.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{k.value}</dd>
            <dd className="mt-1 text-xs text-muted">{k.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="funnel-h" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="funnel-h" className="font-semibold">Hiring funnel</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {o.funnel.map((f, i) => (
              <li key={f.stage} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{STAGE_LABEL[f.stage]}</span>
                  <span className="tabular-nums">
                    <b>{count(f.n)}</b>
                    {i > 0 && <span className="text-muted"> · {Math.round((f.n / top) * 100)}%</span>}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-soft">
                  <div className="h-full rounded-full bg-[#0E6B5F]" style={{ width: `${Math.max(2, Math.round((f.n / top) * 100))}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="weeks-h" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="weeks-h" className="font-semibold">Applicants per week</h2>
          <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label={`Applicants per week over 8 weeks: ${o.weekly.join(", ")}`}>
            {o.weekly.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-muted">{n}</span>
                <div className={`w-full rounded-t-md ${i === o.weekly.length - 1 ? "bg-[#0E6B5F]" : "bg-[#7DB5AC]"}`} style={{ height: `${Math.max(3, Math.round((n / maxWeek) * 96))}px` }} />
              </div>
            ))}
          </div>
          <p className="mt-2 flex justify-between text-xs text-muted">
            <span>8 weeks ago</span>
            <span>This week</span>
          </p>
        </section>
      </div>

      <section aria-labelledby="jobs-h" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-3">
          <h2 id="jobs-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("hire.jobsTitle")}
          </h2>
          <Link href="/hire/candidates" className="text-sm font-medium underline underline-offset-4">
            All candidates →
          </Link>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-6 text-muted">{t("hire.noJobs")}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-3 pe-4 font-normal">{t("hire.colJob")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">Days open</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colViews")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colApplicants")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">Strong matches</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">Avg. match</th>
                  <th scope="col" className="py-3"><span className="sr-only">{t("hire.manage")}</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const p = o.perJob.get(j.id) ?? { views: 0, applicants: 0, strong: 0, avgMatch: null, waiting: 0 };
                  return (
                    <tr key={j.id} className="border-b border-line align-top">
                      <td className="py-4 pe-4">
                        <Link href={`/hire/jobs/${j.id}`} className="font-medium hover:underline">
                          {j.title}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${j.status === "open" ? "bg-[#E8F3F1] text-[#0B5A50]" : "bg-ink-soft"}`}>
                            {j.status === "open" ? t("hire.open") : t("hire.closed")}
                          </span>
                          {[j.city, j.country].filter(Boolean).join(", ")}
                          {p.waiting > 0 && <span className="font-medium text-[#7A4708]">· {p.waiting} waiting</span>}
                        </p>
                      </td>
                      <td className="py-4 pe-4 text-end tabular-nums">{daysSince(j.postedAt)}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{count(p.views)}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{count(p.applicants)}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{p.strong ? <strong>{count(p.strong)}</strong> : 0}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{p.avgMatch === null ? t("hire.none") : `${p.avgMatch}%`}</td>
                      <td className="py-4 text-end">
                        <Link href={`/hire/candidates?job=${encodeURIComponent(j.id)}`} className="inline-flex min-h-10 items-center gap-1 font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                          Candidates
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FeedPanel feeds={feeds} verified={viewer.companyDomainMatches} />
    </>
  );
}
