import { ArrowLeft, ArrowUpRight, Check, CircleDashed, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { ApplyButton } from "@/components/apply-button";
import { JobRow } from "@/components/job-row";
import { MatchRing } from "@/components/match-ring";
import { SaveButton } from "@/components/save-button";
import { getJob, getJobFeed } from "@/data/db";
import type { Job } from "@/data/types";
import { learning, youtubeSearch } from "@/data/learning";
import { t } from "@/i18n";
import { place, postedAgo, salaryRange } from "@/lib/format";
import { matchJob, type ReqStatus } from "@/lib/match";

// Pages for current jobs are built ahead; a job added later is rendered on its first visit.
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

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const { jobs } = await getJobFeed();
  const match = matchJob(job);
  const where = place(job);
  const gaps = match.missing.filter((s) => learning[s]);

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

        <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
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

            <section aria-labelledby="reqs" className="mt-10">
              <h2 id="reqs" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
                {t("job.requirements")}
              </h2>
              <ul className="divide-y divide-line">
                {match.reqs.map((r) => {
                  const { Icon, cls, label } = reqIcon[r.status];
                  return (
                    <li key={r.name} className="flex items-center gap-4 py-3.5">
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${cls}`}>
                        <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 flex-1 font-medium">{r.isYears ? t("job.reqYears", { n: r.name }) : r.name}</span>
                      <span className="text-end text-sm text-muted">{label}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {gaps.length > 0 && (
              <section aria-labelledby="learn" className="mt-10 rounded-2xl bg-surface p-5 sm:p-7">
                <h2 id="learn" className="font-display text-2xl font-semibold tracking-[-0.02em]">
                  {t("job.learnTitle")}
                </h2>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {gaps.map((skill) => {
                    const r = learning[skill];
                    return (
                      <div key={skill}>
                        <h3 className="font-semibold">{skill}</h3>
                        <dl className="mt-2 space-y-2 text-[0.95rem]">
                          <div>
                            <dt className="text-sm text-muted">{t("job.learnCourse")}</dt>
                            <dd>
                              <a href={r.course.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 hover:decoration-ink">
                                {r.course.name}, {r.course.by}
                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                              </a>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted">{t("job.learnVideos")}</dt>
                            <dd>
                              <a href={youtubeSearch(skill)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 hover:decoration-ink">
                                {t("job.learnVideosLabel", { s: skill })}
                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                              </a>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted">{t("job.learnBook")}</dt>
                            <dd>{r.book}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section aria-labelledby="about" className="mt-10">
              <h2 id="about" className="font-display text-2xl font-semibold tracking-[-0.02em]">
                {t("job.about")}
              </h2>
              {job.summary && <p className="mt-3 max-w-[65ch] text-lg text-pretty">{job.summary}</p>}
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
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-sm text-muted">{t("job.yourMatch")}</h2>
              <div className="mt-3 flex items-center gap-4">
                <MatchRing score={match.score} verdict={match.verdict} size={88} />
                <p className="font-display text-xl font-semibold">{t(`verdict.${match.verdict}` as const)}</p>
              </div>
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
