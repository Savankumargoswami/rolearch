import { ArrowLeft, ArrowUpRight, BookOpen, Check, CircleDashed, GraduationCap, Minus, PlayCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { ApplyButton } from "@/components/apply-button";
import { AtsPanel } from "@/components/ats-panel";
import { JobRow } from "@/components/job-row";
import { MatchRing } from "@/components/match-ring";
import { SaveButton } from "@/components/save-button";
import { getJob, getJobFeed, getJobText } from "@/data/db";
import { freeResources } from "@/data/learning";
import type { Job } from "@/data/types";
import { t } from "@/i18n";
import { place, postedAgo, salaryRange } from "@/lib/format";
import type { Match, ReqStatus } from "@/lib/match";
import { loadViewer } from "@/lib/profile";
import { matchProfile } from "@/lib/role-match";

// Pages for current jobs are built ahead; a job added later is rendered on its first visit.
// The personal parts (match, missing skills, ATS check) stream in per visitor.
export async function generateStaticParams() {
  return (await getJobFeed()).jobs.map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return {};
  const where = place(job);
  return {
    title: `${job.title} at ${job.company}`,
    description: [job.summary, `${job.company} · ${where}.`, job.salary ? `${salaryRange(job.salary)}.` : ""].filter(Boolean).join(" "),
    alternates: { canonical: `/jobs/${job.id}` },
  };
}

function similarTo(job: Job, jobs: Job[]) {
  return jobs
    .filter((j) => j.id !== job.id)
    .map((j) => ({ j, shared: j.skills.filter((s) => job.skills.includes(s)).length }))
    .sort((a, b) => b.shared - a.shared || a.j.postedDaysAgo - b.j.postedDaysAgo)
    .slice(0, 3)
    .map((x) => x.j);
}

/** Only for jobs posted directly on Rolearch; feed jobs already carry this on the employer's own page. */
function jobPostingLd(job: Job) {
  const remote = job.workplace === "remote";
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${job.summary}</p><ul>${job.duties.map((d) => `<li>${d}</li>`).join("")}</ul>`,
    datePosted: (job.postedAt ?? "").slice(0, 10) || undefined,
    employmentType: "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: job.company },
    ...(remote
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: job.country } }
      : { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.city, addressCountry: job.country } } }),
    ...(job.salary && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: job.salary.currency,
        value: { "@type": "QuantitativeValue", minValue: job.salary.min, maxValue: job.salary.max, unitText: job.salary.period.toUpperCase() },
      },
    }),
  };
}

const reqIcon: Record<ReqStatus, { Icon: typeof Check; cls: string; label: string }> = {
  verified: { Icon: Check, cls: "bg-ink text-paper", label: t("job.reqVerified") },
  listed: { Icon: CircleDashed, cls: "bg-ink-soft text-ink", label: t("job.reqListed") },
  missing: { Icon: Minus, cls: "border border-line text-muted", label: t("job.reqMissing") },
};

/** The viewer's match with this job, computed from their saved profile (the viewer is read once per request). */
async function viewerMatch(job: Job): Promise<{ signedIn: boolean; hasProfile: boolean; match: Match | null }> {
  const viewer = await loadViewer();
  if (!viewer) return { signedIn: false, hasProfile: false, match: null };
  const p = viewer.profile;
  const hasProfile = p.resume.experience.length + p.resume.skills.length > 0;
  if (!hasProfile) return { signedIn: true, hasProfile, match: null };
  const description = await getJobText(job.id);
  return { signedIn: true, hasProfile, match: matchProfile({ title: job.title, skills: job.skills, years: job.years, description }, p) };
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const { jobs } = await getJobFeed();
  const where = place(job);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <article className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        {job.source === "Rolearch" && (
          <script
            type="application/ld+json"
            // Structured data for search engines' job listings. Content is our own data.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(job)).replace(/</g, "\\u003c") }}
          />
        )}
        <Link
          href="/jobs"
          transitionTypes={["nav-back"]}
          className="inline-flex min-h-11 items-center gap-2 rounded-full pe-3 text-muted transition-colors duration-200 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {t("job.back")}
        </Link>

        <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-12">
          <div className="min-w-0">
            <p className="text-muted">{job.company}</p>
            <ViewTransition name={`job-title-${job.id}`} share="morph" default="none">
              <h1 className="mt-1 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">{job.title}</h1>
            </ViewTransition>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.98rem]">
              <li>
                {where} · {t(`workplace.${job.workplace}` as const)}
              </li>
              <li className="tabular-nums">{job.salary ? salaryRange(job.salary) : <span className="text-muted">{t("job.salaryHidden")}</span>}</li>
              <li className="text-muted">{t("jobs.posted", { when: postedAgo(job.postedDaysAgo) })}</li>
              {job.visa && <li className="text-signal-ink">{t("job.visa")}</li>}
            </ul>
            <p className="mt-2 text-sm text-muted">
              {job.source === "Rolearch" ? t("job.postedOnRolearch") : t("job.source", { c: job.company, s: job.source })}
            </p>

            <section aria-labelledby="about" className="mt-10">
              <h2 id="about" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
                {t("job.about")}
              </h2>
              {job.summary && <p className="mt-4 max-w-[65ch] text-lg text-pretty">{job.summary}</p>}
              {job.duties.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold">{t("job.youllDo")}</h3>
                  <ul className="mt-2 max-w-[65ch] list-disc space-y-1.5 ps-5 marker:text-muted">
                    {job.duties.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </>
              )}
              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  {t("job.fullDescription", { c: job.company })}
                  <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </a>
              )}
            </section>

            <Suspense fallback={<Requirements job={job} match={null} />}>
              <PersonalRequirements job={job} />
            </Suspense>
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <Suspense fallback={<MatchSummary signedIn={false} hasProfile={false} match={null} />}>
                <PersonalMatch job={job} />
              </Suspense>
              <div className="mt-6 flex flex-col gap-3">
                {job.applyUrl ? (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
                  >
                    {t("job.apply")}
                    <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                    <span className="sr-only">{t("job.opensNewTab")}</span>
                  </a>
                ) : (
                  <ApplyButton company={job.company} />
                )}
                <SaveButton id={job.id} />
              </div>
            </div>
            <Suspense fallback={<AtsPanel jobId={job.id} jobTitle={job.title} company={job.company} signedIn={false} hasProfile={false} />}>
              <PersonalAts job={job} />
            </Suspense>
          </aside>
        </div>

        <section aria-labelledby="similar" className="mt-16">
          <h2 id="similar" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("job.similar")}
          </h2>
          <ul className="-mx-3 divide-y divide-line sm:-mx-4">
            {similarTo(job, jobs).map((j) => (
              <li key={j.id}>
                <JobRow job={j} />
              </li>
            ))}
          </ul>
        </section>
      </article>
    </ViewTransition>
  );
}

async function PersonalMatch({ job }: { job: Job }) {
  return <MatchSummary {...await viewerMatch(job)} />;
}

async function PersonalAts({ job }: { job: Job }) {
  const { signedIn, hasProfile } = await viewerMatch(job);
  return <AtsPanel jobId={job.id} jobTitle={job.title} company={job.company} signedIn={signedIn} hasProfile={hasProfile} />;
}

async function PersonalRequirements({ job }: { job: Job }) {
  const { match } = await viewerMatch(job);
  return <Requirements job={job} match={match} />;
}

function MatchSummary({ signedIn, hasProfile, match }: { signedIn: boolean; hasProfile: boolean; match: Match | null }) {
  if (!match) {
    return (
      <>
        <h2 className="text-sm text-muted">{t("match.title")}</h2>
        <p className="mt-2 text-[0.95rem]">{signedIn && !hasProfile ? t("match.buildProfile") : t("match.signIn")}</p>
        <Link
          href={signedIn ? "/account/profile" : "/signin"}
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 font-medium underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          {signedIn ? t("profile.build") : t("nav.signIn")}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </>
    );
  }
  return (
    <>
      <h2 className="text-sm text-muted">{t("match.title")}</h2>
      <div className="mt-3 flex items-center gap-4">
        <MatchRing score={match.score} verdict={match.verdict} size={88} />
        <p className="font-display text-xl font-semibold">{t(`verdict.${match.verdict}` as const)}</p>
      </div>
      <p className="mt-4 text-sm font-medium">{t("match.missingTitle")}</p>
      {match.missing.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {match.missing.map((s) => (
            <li key={s}>
              <a href="#learn" className="inline-flex items-center rounded-full border border-dashed border-[#b4532a]/60 px-2.5 py-1 text-sm hover:border-ink">
                {s}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{t("match.allCovered")}</p>
      )}
    </>
  );
}

function Requirements({ job, match }: { job: Job; match: Match | null }) {
  const reqs = match?.reqs ?? job.skills.map((name) => ({ name, status: "missing" as ReqStatus, isYears: false }));
  return (
    <>
      <section aria-labelledby="reqs" className="mt-10">
        <h2 id="reqs" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
          {t("job.requirements")}
        </h2>
        <ul className="divide-y divide-line">
          {reqs.map((r) => {
            const { Icon, cls, label } = reqIcon[r.status];
            return (
              <li key={r.name} className="flex items-center gap-4 py-3.5">
                {match ? (
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full ${cls}`}>
                    <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
                  </span>
                ) : (
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-soft">
                    <span className="size-1.5 rounded-full bg-ink" />
                  </span>
                )}
                <span className="min-w-0 flex-1 font-medium">{r.isYears ? t("job.reqYears", { n: r.name }) : r.name}</span>
                {match && <span className="text-end text-sm text-muted">{label}</span>}
              </li>
            );
          })}
        </ul>
      </section>
      {match && match.missing.length > 0 && <Learn skills={match.missing} />}
    </>
  );
}

function Learn({ skills }: { skills: string[] }) {
  return (
    <section id="learn" aria-labelledby="learn-h" className="mt-10 scroll-mt-24 rounded-3xl border border-line bg-surface p-5 sm:p-7">
      <h2 id="learn-h" className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.02em]">
        <GraduationCap aria-hidden="true" className="size-6 text-signal-ink" />
        {t("match.learnTitle")}
      </h2>
      <p className="mt-1 text-muted">{t("match.learnLead")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {skills.map((skill) => {
          const { featured, links } = freeResources(skill);
          return (
            <div key={skill} className="flex flex-col rounded-2xl bg-paper/60 p-4">
              <h3 className="font-display text-lg font-semibold">{skill}</h3>
              {featured && (
                <a
                  href={featured.course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-3 flex items-start gap-3 rounded-xl bg-ink p-3 text-paper transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tracking-wide text-signal uppercase">{t("match.featured")}</span>
                    <span className="block font-medium">{featured.course.name}</span>
                    <span className="block text-sm text-[#c9d2de]">{featured.course.by}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-hover:rotate-45" />
                </a>
              )}
              <ul className="mt-3 flex flex-col gap-1">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-[0.95rem] hover:bg-ink-soft">
                      {l.kind === "video" ? (
                        <PlayCircle aria-hidden="true" className="size-4 shrink-0 text-[#b4532a]" />
                      ) : (
                        <BookOpen aria-hidden="true" className="size-4 shrink-0 text-signal-ink" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{l.by}</span>
                      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
              {featured?.book && (
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                  <span className="font-medium text-ink">{t("match.book")}:</span> {featured.book}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
