import { ArrowUpRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { count, postedAgo } from "@/lib/format";
import { applicationsFor, companyJobs, daysSince, viewsFor } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "./company-gate";

export const metadata: Metadata = { title: "Hiring dashboard", robots: { index: false } };

export default function HirePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const viewer = await requireMember("/hire");
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  const db = await createClient();
  const jobs = await companyJobs(db, viewer.id);
  const ids = jobs.map((j) => j.id);
  const [apps, views] = await Promise.all([applicationsFor(db, viewer.id, ids), viewsFor(db, ids)]);

  const per = new Map(ids.map((id) => [id, { views: 0, apps: 0, fresh: 0 }]));
  for (const v of views) per.get(v.jobId)!.views += v.views;
  for (const a of apps) {
    const p = per.get(a.jobId);
    if (!p) continue;
    p.apps += 1;
    if (a.stage === "new") p.fresh += 1;
  }
  const tiles = [
    { label: t("hire.tileOpen"), n: jobs.filter((j) => j.status === "open").length },
    { label: t("hire.tileApplicants"), n: apps.length },
    { label: t("hire.tileNew"), n: apps.filter((a) => a.stage === "new").length },
    { label: t("hire.tileInterview"), n: apps.filter((a) => a.stage === "interview").length },
    { label: t("hire.tileHired"), n: apps.filter((a) => a.stage === "hired").length },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{viewer.companyName}</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("hire.dashboardTitle")}</h1>
          <p className="mt-2 text-muted">{t("hire.lead")}</p>
        </div>
        {viewer.companyDomainMatches && (
          <Link
            href="/hire/new"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("hire.post")}
          </Link>
        )}
      </div>

      {!viewer.companyDomainMatches && <CompanyGate kind="unverified" site={viewer.website} />}

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{x.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{count(x.n)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="jobs-h" className="mt-12">
        <h2 id="jobs-h" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
          {t("hire.jobsTitle")}
        </h2>
        {jobs.length === 0 ? (
          <p className="mt-6 text-muted">{t("hire.noJobs")}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-3 pe-4 font-normal">{t("hire.colJob")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colViews")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colApplicants")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colNew")}</th>
                  <th scope="col" className="py-3 pe-4 text-end font-normal">{t("hire.colRate")}</th>
                  <th scope="col" className="py-3"><span className="sr-only">{t("hire.manage")}</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const p = per.get(j.id)!;
                  const days = daysSince(j.postedAt);
                  return (
                    <tr key={j.id} className="border-b border-line align-top">
                      <td className="py-4 pe-4">
                        <Link href={`/hire/jobs/${j.id}`} className="font-medium hover:underline">
                          {j.title}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${j.status === "open" ? "bg-signal/25 text-ink" : "bg-ink-soft"}`}>
                            {j.status === "open" ? t("hire.open") : t("hire.closed")}
                          </span>
                          {[j.city, j.country].filter(Boolean).join(", ")} · {t("hire.posted", { ago: postedAgo(days) })}
                        </p>
                      </td>
                      <td className="py-4 pe-4 text-end tabular-nums">{count(p.views)}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{count(p.apps)}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{p.fresh ? <strong>{count(p.fresh)}</strong> : 0}</td>
                      <td className="py-4 pe-4 text-end tabular-nums">{p.views ? `${Math.round((p.apps / p.views) * 1000) / 10}%` : t("hire.none")}</td>
                      <td className="py-4 text-end">
                        <Link href={`/hire/jobs/${j.id}`} className="inline-flex min-h-10 items-center gap-1 font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                          {t("hire.manage")}
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
    </>
  );
}
