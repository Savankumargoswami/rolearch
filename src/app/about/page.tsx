import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NOT_OFFERED } from "@/lib/features";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Why Rolearch exists and how it works: real jobs from employers' own career sites, an evidence-based job-fit report before you apply, resume tailoring that never invents, and free tools for job seekers.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Real jobs, from the source",
    body: "Jobs come from employers' own career sites and hiring systems, refreshed daily, plus jobs verified employers post on Rolearch. No staffing-agency reposts. You apply on the employer's own page or with your Rolearch profile.",
  },
  {
    title: "Evidence, not keywords",
    body: "The job-fit report marks each requirement as proven, verified by a skill test, transferable or a gap, and shows the line of your resume behind it. Fit scores are estimates to guide you, never guarantees.",
  },
  {
    title: "Nothing invented",
    body: "Resume tailoring and cover letters use only facts from your own experience. A skill is added only when something you did shows it; otherwise we ask you where you used it.",
  },
  {
    title: "Free for job seekers",
    body: "Job search, the job-fit and ATS check, tailoring, cover letters, skill tests, roadmaps, the tracker and interview prep are free. No ads, no trackers, and we never sell your data.",
  },
];

const OPEN_DATA = [
  { href: "/reports/skills", title: "Skills Report", body: "What employers ask for each month, by industry, including AI skills." },
  { href: "/careers", title: "Career paths", body: "What each role asks for, and which roles your skills carry over to." },
  { href: "/roadmaps", title: "Career roadmaps", body: "Stage-by-stage plans for closing the gap to a new role." },
];

/** Who we are and what we stand for: for people, journalists, career centers and search engines. */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            url: "https://www.rolearch.com/about",
            mainEntity: {
              "@type": "Organization",
              name: "Rolearch",
              url: "https://www.rolearch.com",
              logo: "https://www.rolearch.com/brand/logo.svg",
              email: "admin@rolearch.com",
              founder: { "@type": "Person", name: "Savan" },
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">About Rolearch</p>
      <h1 className="mt-1 max-w-[20ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl sm:leading-[1.02]">
        Don&apos;t just apply to jobs. Apply with direction.
      </h1>
      <div className="mt-6 grid gap-5 text-lg text-muted text-pretty md:max-w-[68ch]">
        <p>
          Most job searches are guesswork. You read a posting, wonder whether you&apos;re qualified, send the same resume to dozens of employers and
          hear nothing back. You never learn which jobs you actually fit, or what stood in the way.
        </p>
        <p>
          Rolearch exists to replace that guesswork with evidence. Before you apply, it shows how your real experience lines up with what the job
          asks for: what you can prove, what transfers, and what&apos;s missing. Then it helps you close the gaps, prove your skills, and keep every
          application organised.
        </p>
        <p>
          It&apos;s built first for people changing careers, whose experience rarely matches a job title word for word but often fits the work.
        </p>
      </div>

      <h2 className="mt-16 font-display text-3xl font-semibold tracking-[-0.02em]">What we stand for</h2>
      <ul className="mt-6 grid gap-5 md:grid-cols-2">
        {PRINCIPLES.map((p, i) => (
          <li key={p.title} className="rounded-3xl border border-line bg-surface p-6">
            <p className="font-display text-sm font-semibold text-signal-ink tabular-nums">0{i + 1}</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-balance">{p.title}</h3>
            <p className="mt-2 text-muted text-pretty">{p.body}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-16 font-display text-3xl font-semibold tracking-[-0.02em]">Open data</h2>
      <p className="mt-2 max-w-[64ch] text-muted">
        We publish what we learn from live job postings, free to read and cite.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {OPEN_DATA.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="group flex h-full flex-col rounded-2xl border border-line p-5 transition-colors hover:border-ink">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                {d.title}
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1.5 text-sm text-muted">{d.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">What Rolearch doesn&apos;t do</h2>
          <ul className="mt-3 list-disc space-y-1.5 ps-5 text-muted">
            {NOT_OFFERED.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Who&apos;s behind it</h2>
          <p className="mt-3 text-muted text-pretty">
            Rolearch was founded by Savan and grows with feedback from the people who use it. What you send through the feedback page goes straight
            to the founder.
          </p>
          <p className="mt-3 text-muted">
            Press, partnerships and career services:{" "}
            <a className="font-medium text-ink underline underline-offset-4" href="mailto:admin@rolearch.com">
              admin@rolearch.com
            </a>
          </p>
        </div>
      </section>

      <section className="mt-16 flex flex-col items-start gap-4 rounded-3xl bg-ink p-8 text-paper sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-balance">See where you fit.</h2>
          <p className="mt-1 text-paper/75">Check your resume against any job, free.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/ats" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-5 font-medium text-ink transition-transform active:scale-[0.96]">
            Check my fit <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/feedback" className="inline-flex min-h-11 items-center rounded-full border border-paper/30 px-5 font-medium text-paper transition-transform hover:border-paper active:scale-[0.96]">
            Send feedback
          </Link>
        </div>
      </section>
    </div>
  );
}
