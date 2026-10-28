import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { t } from "@/i18n";
import { readForm } from "@/lib/application-form";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply", robots: { index: false } };

export default function ApplyPage({ params }: PageProps<"/jobs/[id]/apply">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Apply params={params} />
      </Suspense>
    </div>
  );
}

async function Apply({ params }: { params: PageProps<"/jobs/[id]/apply">["params"] }) {
  const { id } = await params;
  const viewer = await requireMember(`/jobs/${id}/apply`);
  const db = await createClient();
  const { data: job } = await db.from("jobs").select("id,title,company,status,posted_by,questions").eq("id", id).maybeSingle();
  if (!job || !job.posted_by) notFound();
  const { data: existing } = await db.from("applications").select("id").eq("job_id", id).eq("applicant_id", viewer.id).maybeSingle();
  const p = viewer.profile;
  const ready = Boolean(p.full_name.trim()) && p.resume.experience.length + p.resume.skills.length + p.resume.education.length > 0;
  const form = readForm(job.questions);
  // Prefilled from the profile; the applicant can change anything before sending.
  const [first, ...rest] = p.full_name.trim().split(/\s+/);
  const linkedin = p.links.find((l) => /linkedin\.com/i.test(l.url))?.url ?? "";
  const website = p.links.find((l) => l.url && !/linkedin\.com/i.test(l.url))?.url ?? "";
  const prefill = { firstName: first ?? "", lastName: rest.join(" "), phone: "", location: p.location, linkedin, website };
  const resume = {
    roles: p.resume.experience.map((e) => [e.title, e.company].filter(Boolean).join(", ")),
    schools: p.resume.education.map((e) => [e.degree, e.school].filter(Boolean).join(", ")),
    skills: p.resume.skills,
  };

  return (
    <>
      <Link href={`/jobs/${id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {job.title}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("apply.title", { title: job.title })}</h1>
      <p className="mt-1 text-lg text-muted">{t("apply.at", { company: job.company })}</p>

      {viewer.accountType === "company" ? (
        <p role="note" className="mt-8 rounded-2xl border border-line bg-surface p-5">{t("apply.errCompany")}</p>
      ) : existing ? (
        <div role="status" className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <p>{t("apply.errAlready")}</p>
          <Link href="/tracker" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">{t("apply.toTracker")}</Link>
        </div>
      ) : job.status !== "open" ? (
        <p role="note" className="mt-8 rounded-2xl border border-line bg-surface p-5">{t("apply.errClosed")}</p>
      ) : (
        <>
          <section aria-labelledby="send-h" className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <h2 id="send-h" className="font-display text-xl font-semibold">{t("apply.sendTitle", { company: job.company })}</h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar url={viewer.avatarUrl} name={p.full_name || viewer.email} size={48} />
              <div className="min-w-0">
                <p className="truncate font-medium">{p.full_name || viewer.email}</p>
                <p className="truncate text-sm text-muted">{[p.headline, p.location].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">{t("apply.sendBody")}</p>
            <Link href="/account/profile" className="mt-2 inline-flex min-h-10 items-center text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
              {t("apply.editProfile")}
            </Link>
          </section>
          {ready ? (
            <ApplyForm jobId={id} company={job.company} form={form} prefill={prefill} resume={resume} />
          ) : (
            <p role="alert" className="mt-6 rounded-2xl border border-[#b4532a]/50 bg-[#b4532a]/5 p-5">{t("apply.errProfile")}</p>
          )}
        </>
      )}
    </>
  );
}
