import { ArrowLeft, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { MatchRing } from "@/components/match-ring";
import { ResumeView } from "@/components/resume-view";
import { t, type MessageKey } from "@/i18n";
import { application, companyJob, events, type EventRow } from "@/lib/hiring";
import type { Requirement, Verdict } from "@/lib/match";
import type { ProfileData } from "@/lib/profile-schema";
import { withDefaults } from "@/lib/profile-schema";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "../../company-gate";
import { EventComposer, StageMenu } from "../../pipeline-controls";

export const metadata: Metadata = { title: "Applicant", robots: { index: false } };

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default function ApplicantPage({ params }: PageProps<"/hire/applications/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Applicant params={params} />
      </Suspense>
    </div>
  );
}

async function Applicant({ params }: { params: PageProps<"/hire/applications/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireMember(`/hire/applications/${id}`);
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  const db = await createClient();
  const app = await application(db, id);
  if (!app) notFound();
  const job = await companyJob(db, viewer.id, app.jobId);
  if (!job) notFound();
  const history = (await events(db, [app.id])).get(app.id) ?? [];
  const s = app.snapshot;
  const resume = withDefaults({ resume: (s.resume as ProfileData["resume"]) ?? undefined }).resume;
  const reqs = ((app.match as { reqs?: Requirement[] }).reqs ?? []).slice(0, 24);
  const verdict = (app.match.verdict as Verdict) ?? "weak";

  return (
    <>
      <Link href={`/hire/jobs/${job.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("hire.candidateBack")} · {job.title}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <header className="flex flex-wrap items-center gap-4">
            <Avatar url={s.avatar} name={s.name} size={72} />
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-[-0.025em]">{s.name}</h1>
              {s.headline && <p className="text-lg">{s.headline}</p>}
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {s.location && <span>{s.location}</span>}
                {s.email && (
                  <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 hover:decoration-ink">
                    <Mail aria-hidden="true" className="size-4" />
                    {s.email}
                  </a>
                )}
                {s.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:decoration-ink">
                    {l.label || l.url.replace(/^https?:\/\//, "")}
                  </a>
                ))}
              </p>
            </div>
          </header>

          <section aria-labelledby="match-h" className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <h2 id="match-h" className="font-display text-xl font-semibold">{t("hire.matchBreakdown")}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              {app.matchScore != null && <MatchRing score={app.matchScore} verdict={verdict} size={72} />}
              <div>
                <p className="font-medium">{t(`verdict.${verdict}` as MessageKey)}</p>
                {app.atsScore != null && <p className="text-sm text-muted">{t("hire.ats", { n: app.atsScore })}</p>}
              </div>
            </div>
            {reqs.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {reqs.map((r) => (
                  <li
                    key={`${r.group}-${r.name}`}
                    className={`rounded-full border px-2.5 py-1 text-sm ${
                      r.status === "verified" ? "border-[#2f7d5b]/50 bg-[#2f7d5b]/10" : r.status === "listed" ? "border-line" : "border-dashed border-[#b4532a]/60"
                    }`}
                  >
                    {r.isYears ? t("job.reqYears", { n: r.name }) : r.group === "education" ? t(`job.edu_${r.name}` as MessageKey) : r.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {app.answers.length > 0 && (
            <section aria-labelledby="ans-h" className="mt-8">
              <h2 id="ans-h" className="font-display text-xl font-semibold">{t("hire.answersTitle")}</h2>
              <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
                {app.answers.map((a) => (
                  <div key={a.q} className="p-4">
                    <dt className="text-sm text-muted">{a.q}</dt>
                    <dd className="mt-1 font-medium">{a.a === "yes" ? t("apply.yes") : a.a === "no" ? t("apply.no") : a.a || t("hire.none")}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {app.note && (
            <section aria-labelledby="note-h" className="mt-8">
              <h2 id="note-h" className="font-display text-xl font-semibold">{t("hire.noteFromApplicant")}</h2>
              <p className="mt-2 whitespace-pre-line rounded-2xl border border-line bg-surface p-4">{app.note}</p>
            </section>
          )}

          <section aria-labelledby="resume-h" className="mt-8">
            <h2 id="resume-h" className="border-b border-ink pb-3 font-display text-xl font-semibold">{t("hire.resumeTitle")}</h2>
            <div className="mt-4">
              <ResumeView resume={resume} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{t(`hire.st_${app.stage}` as MessageKey)}</p>
            {app.stage === "withdrawn" ? <p className="mt-2">{t("hire.errWithdrawn")}</p> : <div className="mt-3"><StageMenu appId={app.id} stage={app.stage} /></div>}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <EventComposer appId={app.id} />
          </div>
          <section aria-labelledby="hist-h" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="hist-h" className="font-medium">{t("hire.historyTitle")}</h2>
            <ol className="mt-3 flex flex-col gap-3">
              {[...history].reverse().map((e) => (
                <li key={e.id} className="border-s-2 border-line ps-3">
                  <p className="text-sm font-medium">{eventLabel(e)}</p>
                  {e.body && <p className="mt-1 whitespace-pre-line text-sm">{e.body}</p>}
                  <p className="mt-1 text-xs text-muted">{when.format(new Date(e.createdAt))}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

function eventLabel(e: EventRow): string {
  const st = (s: string | null) => (s ? t(`hire.st_${s}` as MessageKey) : "");
  if (e.kind === "applied") return t("hire.evApplied");
  if (e.kind === "withdrawn") return t("hire.evWithdrawn");
  if (e.kind === "note") return t("hire.evNote");
  if (e.kind === "message") return t("hire.evMessage");
  return t("hire.evStage", { from: st(e.fromStage), to: st(e.toStage) });
}
