import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompanyBar } from "@/components/company-bar";
import { applicationsFor, companyJobs, daysSince, STRONG, WAITING_DAYS } from "@/lib/hiring";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "../company-gate";
import { StageMenu } from "../pipeline-controls";

export const metadata: Metadata = { title: "Candidates", robots: { index: false } };

type Search = Promise<{ job?: string; strong?: string; waiting?: string; stage?: string }>;

const STAGES = [
  ["", "All stages"],
  ["new", "New"],
  ["screening", "Screening"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["hired", "Hired"],
  ["rejected", "Not moving forward"],
] as const;

export default function CandidatesPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Candidates searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Candidates({ searchParams }: { searchParams: Search }) {
  const viewer = await requireMember("/hire/candidates");
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  const sp = await searchParams;
  const db = await createClient();
  const jobs = await companyJobs(db, viewer.id);
  const titles = new Map(jobs.map((j) => [j.id, j.title]));
  const apps = await applicationsFor(db, viewer.id, jobs.map((j) => j.id));
  const isWaiting = (a: (typeof apps)[number]) => a.stage === "new" && daysSince(a.createdAt) >= WAITING_DAYS;
  const shown = apps
    .filter((a) => (!sp.job || a.jobId === sp.job) && (!sp.strong || (a.matchScore ?? 0) >= STRONG) && (!sp.waiting || isWaiting(a)) && (!sp.stage || a.stage === sp.stage))
    .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

  return (
    <>
      <CompanyBar name={viewer.companyName} website={viewer.website} verified={viewer.companyDomainMatches} current="candidates" />
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-[-0.025em]">Candidates</h1>
      <p className="mt-1 text-muted">Ranked by verified match. Move anyone to a new stage; they see the update in their tracker.</p>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Job</span>
          <select name="job" defaultValue={sp.job ?? ""} className="h-10 min-w-48 rounded-lg border border-line bg-paper px-2">
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Stage</span>
          <select name="stage" defaultValue={sp.stage ?? ""} className="h-10 rounded-lg border border-line bg-paper px-2">
            {STAGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="strong" value="1" defaultChecked={Boolean(sp.strong)} className="size-4 accent-ink" />
          Strong matches only ({STRONG}%+)
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="waiting" value="1" defaultChecked={Boolean(sp.waiting)} className="size-4 accent-ink" />
          Waiting {WAITING_DAYS}+ days
        </label>
        <button type="submit" className="min-h-10 cursor-pointer rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-hover">
          Apply filters
        </button>
        {(sp.job || sp.strong || sp.waiting || sp.stage) && (
          <Link href="/hire/candidates" className="min-h-10 content-center text-sm underline underline-offset-4">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-muted">
        {shown.length} {shown.length === 1 ? "candidate" : "candidates"}
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">No one here yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {shown.map((a) => {
            const strong = (a.matchScore ?? 0) >= STRONG;
            const waiting = isWaiting(a);
            const days = daysSince(a.createdAt);
            return (
              <li key={a.id} className={`flex flex-col rounded-2xl border bg-surface p-4 ${waiting ? "border-[#E3B86B]" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/hire/applications/${a.id}`} className="font-semibold hover:underline">
                      {a.snapshot.name || "Applicant"}
                    </Link>
                    {a.snapshot.headline && <p className="truncate text-sm text-muted">{a.snapshot.headline}</p>}
                    <p className="mt-1 text-xs text-muted">For: {titles.get(a.jobId) ?? "a job"}</p>
                  </div>
                  {a.matchScore !== null && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${strong ? "bg-[#E8F3F1] text-[#0B5A50]" : "bg-[#FDF3E3] text-[#7A4708]"}`}>{a.matchScore}% match</span>
                  )}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted">
                  {a.atsScore !== null && <span>Resume ATS {a.atsScore}%</span>}
                  {(a.match.missing?.length ?? 0) > 0 && <span>Missing: {a.match.missing!.slice(0, 3).join(", ")}</span>}
                </p>
                <p className={`mt-1 text-sm ${waiting ? "font-semibold text-[#7A4708]" : "text-muted"}`}>
                  {waiting ? `Waiting ${days} days for a reply` : `Applied ${days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`}`}
                </p>
                <div className="mt-auto pt-2">
                  <StageMenu appId={a.id} stage={a.stage} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
