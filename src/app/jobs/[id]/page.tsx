import { ArrowLeft, ArrowUpRight, BookOpen, Check, CircleDashed, GraduationCap, Minus, PlayCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache, Suspense, ViewTransition } from "react";
import { ApplyButton } from "@/components/apply-button";
import { CompanyLogo } from "@/components/company-logo";
import { JobDescription } from "@/components/job-description";
import { AtsPanel } from "@/components/ats-panel";
import { HiringTeam } from "@/components/hiring-team";
import { JobRow } from "@/components/job-row";
import { MatchRing } from "@/components/match-ring";
import { ExternalApply, TrackButton } from "@/components/track-button";
import { getJob, getJobFeed, getJobText, searchJobs } from "@/data/db";
import { freeResources } from "@/data/learning";
import type { Job } from "@/data/types";
import { t, type MessageKey } from "@/i18n";
import { place, postedAgo, salaryRange } from "@/lib/format";
import { jobRequirements, type JobRequirements } from "@/lib/job-requirements";
import type { Match, ReqStatus, Requirement } from "@/lib/match";
import { loadViewer } from "@/lib/profile";
import { matchProfile } from "@/lib/role-match";
import { createClient } from "@/lib/supabase/server";

// The ATS check's actions run here: reading a resume and tailoring it take 20-40 seconds each.
export const maxDuration = 120;

// Pages for current jobs are built ahead; a job added later is rendered on its first visit.
// The personal parts (match, missing skills, ATS check) stream in per visitor.
export async function generateStaticParams() {
  return (await getJobFeed()).jobs.slice(0, 300).map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return { robots: { index: false } };
  const where = place(job);
  // Job pages are public so search engines can list them; match, ATS check and tracking need an account.
  return {
    title: `${job.title} at ${job.company}`,
    description: [job.summary, `${job.company} · ${where}.`, job.salary ? `${salaryRange(job.salary)}.` : ""].filter(Boolean).join(" "),
    alternates: { canonical: `/jobs/${job.id}` },
  };
}

/** Same kind of role: the title's core words, within the same category. */
async function similarTo(job: Job) {
  const words = job.title.replace(/\(.*?\)|[-–—|,].*$/g, " ").replace(/\b(senior|sr|junior|jr|staff|lead|principal|ii|iii|iv)\b\.?/gi, " ").trim().split(/\s+/).filter(Boolean);
  // One generic word ("Associate", "Intern") matches 100,000+ jobs and is slow to rank: the newest jobs in the same
  // category are just as relevant and fast.
  const core = words.length > 1 ? words.slice(0, 3).join(" ") : "";
  const { jobs } = await searchJobs({ q: core, cat: job.category ?? "all", where: "anywhere", remote: false, visa: false, pay: false, level: "any", sort: core ? "match" : "newest" }, 1, 4);
  return jobs.filter((j) => j.id !== job.id).slice(0, 3);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The plain-text description as simple HTML: paragraphs, and bullet lines as lists. */
function descriptionHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^[-•*·]\s/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-•*·]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return lines.length ? `<p>${lines.map(escapeHtml).join("<br>")}</p>` : "";
    })
    .join("");
}

/** schema.org JobPosting, so search engines (Google for Jobs) can list the job. Matches what the page shows. */
function jobPostingLd(job: Job, text: string) {
  const remote = job.workplace === "remote";
  const country = job.countryCode || undefined;
  const fallback = `<p>${escapeHtml(job.summary)}</p>${job.duties.length ? `<ul>${job.duties.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` : ""}`;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: text.trim().length >= 120 ? descriptionHtml(text) : fallback,
    identifier: { "@type": "PropertyValue", name: job.company, value: job.id },
    datePosted: (job.postedAt ?? "").slice(0, 10) || undefined,
    // No directApply: applying needs a Rolearch account first.
    ...(job.source === "Rolearch" && { employmentType: "FULL_TIME" }),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      ...(job.companyDomain && { sameAs: `https://${job.companyDomain}`, logo: `https://www.rolearch.com/logo/${job.companyDomain}` }),
    },
    ...(remote
      ? { jobLocationType: "TELECOMMUTE", ...(country && { applicantLocationRequirements: { "@type": "Country", name: country } }) }
      : {
          jobLocation: {
            "@type": "Place",
            // Without a known city, `city` holds the country name; leave the locality out then.
            address: {
              "@type": "PostalAddress",
              ...(job.city && job.city !== "Remote" && job.city !== job.country && { addressLocality: job.city }),
              addressCountry: country ?? job.country,
            },
          },
        }),
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

type ViewerMatch = { signedIn: boolean; hasProfile: boolean; match: Match | null; req: JobRequirements | null };

/**
 * The viewer's match with this job, from their saved profile and the job's requirements (read from its
 * description once, then stored). Cached per request: the match card, ATS panel and list all share it.
 */
const viewerMatch = cache(async (id: string): Promise<ViewerMatch> => {
  const job = await getJob(id);
  const viewer = await loadViewer();
  if (!job || !viewer) return { signedIn: Boolean(viewer), hasProfile: false, match: null, req: null };
  const description = await getJobText(job.id);
  const req = await jobRequirements(job, description);
  const p = viewer.profile;
  const hasProfile = p.resume.experience.length + p.resume.skills.length > 0;
  if (!hasProfile) return { signedIn: true, hasProfile, match: null, req };
  return { signedIn: true, hasProfile, match: matchProfile({ title: job.title, skills: job.skills, years: job.years, description }, p, req), req };
});

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-6xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <JobBody params={params} />
    </Suspense>
  );
}

async function JobBody({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  if (job.source === "Rolearch") {
    // Count the view for the company's analytics once the page has been sent.
    const db = await createClient();
    after(async () => {
      await db.rpc("record_job_view", { p_job: job.id });
    });
  }
  const [similar, text] = await Promise.all([similarTo(job), getJobText(job.id)]);
  const where = place(job);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <article className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        {/* Search engines require a description, so jobs without one get no listing data. */}
        {(text.trim() || job.summary.trim()) && (
          <script
            type="application/ld+json"
            // Structured data for search engines' job listings; "<" is escaped so the text can't close the tag.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(job, text)).replace(/</g, "\\u003c") }}
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
            <p className="flex items-center gap-3 text-muted">
              <CompanyLogo domain={job.companyDomain} name={job.company} size={44} />
              {job.company}
            </p>
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
              <Suspense fallback={job.summary ? <p className="mt-4 max-w-[65ch] text-lg text-pretty">{job.summary}</p> : null}>
                <FullDescription job={job} />
              </Suspense>
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
              <Suspense fallback={null}>
                <EmployerLink job={job} />
              </Suspense>
            </section>

            <Suspense fallback={<Requirements job={job} match={null} req={null} />}>
              <PersonalRequirements job={job} />
            </Suspense>
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <Suspense fallback={<MatchSummary signedIn={false} hasProfile={false} match={null} />}>
                <PersonalMatch job={job} />
              </Suspense>
              <div className="mt-6 flex flex-col gap-3">
                <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
                  <ApplyArea job={job} />
                </Suspense>
              </div>
            </div>
            <HiringTeam title={job.title} company={job.company} />
            <Suspense fallback={<AtsPanel target={job.id} next={`/jobs/${job.id}#ats-h`} jobTitle={job.title} company={job.company} signedIn={false} hasProfile={false} />}>
              <PersonalAts job={job} />
            </Suspense>
          </aside>
        </div>

        <section aria-labelledby="similar" className="mt-16">
          <h2 id="similar" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("job.similar")}
          </h2>
          <ul className="-mx-3 divide-y divide-line sm:-mx-4">
            {similar.map((j) => (
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

/** Apply and save controls: Rolearch jobs apply with the profile; other jobs go to the company and can be tracked. */
async function ApplyArea({ job }: { job: Job }) {
  const viewer = await loadViewer();
  if (!viewer) return <VisitorApply job={job} />;
  const db = await createClient();
  const [{ data: tracked }, { data: app }] = viewer
    ? await Promise.all([
        db.from("tracked_jobs").select("status").eq("user_id", viewer.id).eq("job_id", job.id).maybeSingle(),
        job.source === "Rolearch" ? db.from("applications").select("id").eq("job_id", job.id).eq("applicant_id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }];
  const status = (tracked?.status as string | undefined) ?? null;
  return (
    <>
      {job.source === "Rolearch" ? (
        app ? (
          <Link href="/tracker" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-ink-soft">
            <Check aria-hidden="true" className="size-4" />
            {t("apply.appliedCta")}
          </Link>
        ) : viewer?.accountType === "company" ? null : (
          <Link
            href={`/jobs/${job.id}/apply`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
          >
            {t("apply.cta")}
          </Link>
        )
      ) : job.applyUrl ? (
        <ExternalApply id={job.id} url={job.applyUrl} company={job.company} applied={status !== null && status !== "saved"} />
      ) : (
        <ApplyButton company={job.company} />
      )}
      {!app && <TrackButton id={job.id} status={status} />}
    </>
  );
}

/** Visitors can read the job and apply on the employer's site; saving and tracking need a free account. */
function VisitorApply({ job }: { job: Job }) {
  // After sign-up, Rolearch jobs go straight to the apply form; other jobs back to this page and its apply link.
  const next = encodeURIComponent(job.source === "Rolearch" ? `/jobs/${job.id}/apply` : `/jobs/${job.id}`);
  return (
    <>
      <Link
        href={`/signup?next=${next}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
      >
        {t("job.signUpToApply")}
      </Link>
      <p className="text-sm text-muted text-pretty">{t("job.visitorSave")}</p>
    </>
  );
}

/** The employer's own job page, for members (visitors apply after signing up). */
async function EmployerLink({ job }: { job: Job }) {
  if (!job.jobUrl || job.source === "Rolearch" || !(await loadViewer())) return null;
  return (
    <a
      href={job.jobUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-line underline-offset-4 hover:decoration-ink"
    >
      {t("job.applyOnSite", { c: job.company })}
      <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
    </a>
  );
}

async function PersonalMatch({ job }: { job: Job }) {
  return <MatchSummary {...await viewerMatch(job.id)} />;
}

async function PersonalAts({ job }: { job: Job }) {
  const { signedIn, hasProfile } = await viewerMatch(job.id);
  return <AtsPanel target={job.id} next={`/jobs/${job.id}#ats-h`} jobTitle={job.title} company={job.company} signedIn={signedIn} hasProfile={hasProfile} />;
}

async function PersonalRequirements({ job }: { job: Job }) {
  const { match, req } = await viewerMatch(job.id);
  return <Requirements job={job} match={match} req={req} />;
}

async function FullDescription({ job }: { job: Job }) {
  const text = await getJobText(job.id);
  if (text.trim().length < 120) return job.summary ? <p className="mt-4 max-w-[65ch] text-lg text-pretty">{job.summary}</p> : null;
  return (
    <div className="mt-4">
      <JobDescription text={text} moreLabel={t("job.showFull")} />
    </div>
  );
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

const GROUPS = ["required", "certification", "experience", "education", "preferred"] as const;

function Requirements({ job, match, req }: { job: Job; match: Match | null; req: JobRequirements | null }) {
  // Without a match (visitor without a profile) still list what the job asks for, just without statuses.
  const reqs: Requirement[] =
    match?.reqs ??
    (req
      ? [
          ...req.required.map((name) => ({ name, status: "missing" as ReqStatus, group: "required" as const })),
          ...req.certifications.map((name) => ({ name, status: "missing" as ReqStatus, group: "certification" as const })),
          ...(req.years ? [{ name: String(req.years), status: "missing" as ReqStatus, isYears: true, group: "experience" as const }] : []),
          ...(req.education !== "none" ? [{ name: req.education, status: "missing" as ReqStatus, group: "education" as const }] : []),
          ...req.preferred.map((name) => ({ name, status: "missing" as ReqStatus, group: "preferred" as const })),
        ]
      : job.skills.map((name) => ({ name, status: "missing" as ReqStatus, group: "required" as const })));
  const label = (r: Requirement) =>
    r.isYears ? t("job.reqYears", { n: r.name }) : r.group === "education" ? t(`job.edu_${r.name}` as MessageKey) : r.name;
  const groups = GROUPS.map((g) => ({ g, items: reqs.filter((r) => (r.group ?? "required") === g) })).filter((x) => x.items.length > 0);
  if (!groups.length) return null;

  return (
    <>
      <section aria-labelledby="reqs" className="mt-10">
        <h2 id="reqs" className="border-b border-ink pb-3 font-display text-2xl font-semibold tracking-[-0.02em]">
          {t("job.requirements")}
        </h2>
        {req && <p className="mt-2 text-sm text-muted">{t("job.reqFromDescription")}</p>}
        {groups.map(({ g, items }) => (
          <div key={g} className="mt-5">
            <h3 className="text-sm font-semibold tracking-wide text-signal-ink uppercase">{t(`job.reqGroup_${g}` as MessageKey)}</h3>
            <ul className="mt-1 divide-y divide-line">
              {items.map((r) => {
                const { Icon, cls, label: statusLabel } = reqIcon[r.status];
                return (
                  <li key={`${g}-${r.name}`} className="flex items-center gap-4 py-3">
                    {match ? (
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${cls}`}>
                        <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-soft">
                        <span className="size-1.5 rounded-full bg-ink" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 font-medium">{label(r)}</span>
                    {match && <span className="text-end text-sm text-muted">{statusLabel}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      {match && match.missing.length > 0 && <Learn skills={match.missing.slice(0, 8)} />}
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
