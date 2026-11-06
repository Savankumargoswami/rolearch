import { ArrowRight, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getJob } from "@/data/db";
import { t } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { InterviewPrep } from "./prep";

export const metadata: Metadata = { title: "Interview preparation", robots: { index: false } };
// Generating questions and feedback takes a few seconds each.
export const maxDuration = 60;

export default function InterviewPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("interview.eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("interview.title")}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t("interview.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Prep searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Prep({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: jobId } = await searchParams;
  const viewer = await requireMember(`/interview${jobId ? `?job=${encodeURIComponent(jobId)}` : ""}`);
  const job = jobId ? await getJob(jobId) : null;
  if (job) return <InterviewPrep jobId={job.id} title={job.title} company={job.company} />;

  // No job picked: offer the member's tracked jobs, interviews first.
  const db = await createClient();
  const { data } = await db.from("tracked_jobs").select("job_id,title,company,status").eq("user_id", viewer.id).in("status", ["interviewing", "applied", "saved", "offer"]).order("updated_at", { ascending: false }).limit(30);
  const order = ["interviewing", "offer", "applied", "saved"];
  const jobs = (data ?? []).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  if (!jobs.length) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-line p-8 text-center">
        <MessagesSquare aria-hidden="true" className="mx-auto size-8 text-muted" />
        <p className="mt-3 text-muted">{t("interview.empty")}</p>
        <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("tracker.findJobs")}
        </Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="pick-h" className="mt-8">
      <h2 id="pick-h" className="font-display text-xl font-semibold">
        {t("interview.pick")}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {jobs.map((j) => (
          <li key={j.job_id}>
            <Link
              href={`/interview?job=${encodeURIComponent(j.job_id)}`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-ink"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{j.title}</span>
                <span className="block text-sm text-muted">
                  {j.company} · {t(`tracker.s_${j.status}` as "tracker.s_saved")}
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
