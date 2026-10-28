import { ArrowRight, BadgeCheck, ClipboardList, Gauge, ListChecks, Rss, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hire on Rolearch: free job posts for employers",
  description:
    "Post jobs free on Rolearch. Applicants fill in the application form you design, and you see them ranked by how well their resume matches the job. Direct employers only, no agencies.",
  alternates: { canonical: "/employers" },
};

const SIGNUP = "/signup?as=company";

const FEATURES = [
  { icon: ClipboardList, title: "Your application form", body: "Choose which fields to ask for (phone, work authorization, sponsorship, start date, pay) and add up to 10 questions of your own." },
  { icon: Gauge, title: "Applicants ranked by match", body: "Every applicant gets a match score against your job's skills and experience, checked against their resume, so the best fits are at the top." },
  { icon: UsersRound, title: "A simple pipeline", body: "Move people from New to Screening, Interview, Offer and Hired. Applicants see each update, so nobody is left wondering." },
  { icon: ListChecks, title: "Hiring dashboard", body: "Applicants per job, your funnel, reply times, and who has been waiting more than 14 days for an answer." },
  { icon: Rss, title: "Or connect your job feed", body: "Already on Greenhouse, Lever, Ashby, Workday or another hiring system? Connect it and your jobs stay in sync automatically." },
  { icon: ShieldCheck, title: "Only real employers", body: "No staffing agencies or reposted listings. Every job is reviewed before it goes live, which is why job seekers trust what they find here." },
];

const STEPS = [
  ["Sign up with your work email", "Use your company email (you@yourcompany.com). It's how we verify you're the employer."],
  ["Post a job", "Title, location, description, pay and your application form. It's reviewed and live in minutes."],
  ["Review applicants", "See them ranked by match, read their answers and move them through your pipeline."],
] as const;

export default function EmployersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold tracking-wide text-signal-ink uppercase">For employers</p>
          <h1 className="mt-3 max-w-[16ch] font-display text-4xl font-semibold leading-[1.03] tracking-[-0.03em] text-balance sm:text-6xl">
            Post jobs free. Hire people who fit.
          </h1>
          <p className="mt-5 max-w-[56ch] text-lg text-muted text-pretty">
            Rolearch lists more than a million jobs straight from employers, with no agencies. Post yours free, ask the questions you need, and see applicants ranked by how well they match.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={SIGNUP} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-ink-hover">
              Create a company account <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </Link>
            <Link href="/signin?next=/hire" className="inline-flex min-h-12 items-center rounded-full border border-ink px-6 font-medium hover:bg-ink hover:text-paper">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Free to post. No credit card.</p>
        </div>

        {/* A small picture of the product: one applicant as the employer sees them. */}
        <div aria-hidden="true" className="rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_60px_-30px_rgba(14,31,47,0.35)]">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Candidates · Operations Manager</p>
          {[
            ["Maya R.", "Operations lead, 6 yrs", 92, "Interview"],
            ["Daniel K.", "Shift supervisor, 4 yrs", 84, "Screening"],
            ["Priya S.", "Logistics coordinator, 3 yrs", 71, "New"],
          ].map(([name, line, score, stage]) => (
            <div key={name as string} className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line p-3">
              <div className="min-w-0">
                <p className="font-semibold">{name}</p>
                <p className="truncate text-sm text-muted">{line}</p>
                <p className="mt-1 flex gap-1.5 text-xs">
                  <span className="rounded-full bg-[#E8F3F1] px-2 py-0.5 text-[#0B5A50]">Authorized to work: Yes</span>
                  <span className="rounded-full bg-ink-soft px-2 py-0.5">{stage}</span>
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${Number(score) >= 80 ? "bg-[#E8F3F1] text-[#0B5A50]" : "bg-[#FDF3E3] text-[#7A4708]"}`}>{score}% match</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="what-h" className="mt-20">
        <h2 id="what-h" className="font-display text-3xl font-semibold tracking-[-0.025em]">What you get</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-ink text-paper">
                <f.icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="mt-20">
        <h2 id="how-h" className="font-display text-3xl font-semibold tracking-[-0.025em]">Live in three steps</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-2xl bg-ink-soft p-5">
              <span className="font-display text-3xl font-semibold text-signal-ink tabular-nums">{i + 1}</span>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 rounded-3xl bg-ink p-8 text-paper sm:p-12">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[#c9d2de]">
          <BadgeCheck aria-hidden="true" className="size-4" /> Verified employers only
        </p>
        <h2 className="mt-3 max-w-[22ch] font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Your next hire is already looking on Rolearch.</h2>
        <p className="mt-3 max-w-[58ch] text-[#c9d2de]">Sign up with your work email and post your first job today. Questions? Email admin@rolearch.com and we&apos;ll help you set it up.</p>
        <Link href={SIGNUP} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 font-medium text-ink hover:bg-white">
          Create a company account <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </section>
    </div>
  );
}
