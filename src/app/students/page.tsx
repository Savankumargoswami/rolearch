import { ArrowRight, Download, GraduationCap, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbs, JsonLd } from "@/components/json-ld";
import { SchoolLink } from "@/components/school-link";

export const metadata: Metadata = {
  title: "Rolearch for students and new grads",
  description:
    "Free for students: see which jobs and internships you already qualify for, check your resume against any posting, and learn the skills employers ask for. Career advisors: a free handout, a 45-minute workshop plan and a link for your resources page.",
  alternates: { canonical: "/students" },
};

const STEPS = [
  {
    title: "Check your fit for a real job",
    body: "Paste any posting and your resume. See your match, the skills you're missing and what to fix before you apply.",
    href: "/ats",
    cta: "Run the free check",
  },
  {
    title: "Find entry-level jobs and internships",
    body: "Search jobs straight from employers' career sites, filtered to entry level, with the skills each one asks for.",
    href: "/jobs?level=entry",
    cta: "Search entry-level jobs",
  },
  {
    title: "Pick a direction",
    body: "See what each role asks for, measured from live postings, and which roles your skills already carry over to.",
    href: "/careers",
    cta: "Explore career paths",
  },
  {
    title: "Close a gap and prove it",
    body: "Follow a free roadmap for the skill you're missing, then take a skill test. Score 90% or more for a badge you can add to LinkedIn.",
    href: "/roadmaps",
    cta: "Open the roadmaps",
  },
];

const BROWSE = [
  { href: "/roles", label: "Jobs by role and city" },
  { href: "/today/new", label: "New jobs posted today" },
  { href: "/today/visa", label: "Jobs that sponsor visas" },
  { href: "/reports/skills", label: "Monthly Skills Report" },
  { href: "/guides", label: "Career-change guides" },
  { href: "/extension", label: "Chrome extension" },
];

const WORKSHOP = [
  { min: "5 min", title: "What employers ask for", body: "Open the Skills Report for the class's field: the skills rising and fading in this month's postings." },
  { min: "15 min", title: "One real job each", body: "Each student finds a posting they'd apply to and runs the free fit check with their resume." },
  { min: "15 min", title: "Gaps in pairs", body: "Partners compare results: which skills are proven, which are missing, and which gap is quickest to close." },
  { min: "10 min", title: "A next step", body: "Each student opens the roadmap for one missing skill or starts its skill test, and writes down one thing to do this week." },
];

const FAQ = [
  { q: "Is Rolearch free for students?", a: "Yes. Searching jobs, the job-fit check, roadmaps, skill tests and the Skills Report are free for students, with no card needed." },
  {
    q: "I don't have much experience. Is it still useful?",
    a: "Yes. The fit check counts projects, internships and part-time work on your resume as well as your education, and shows which skills you've already shown and which are missing.",
  },
  {
    q: "I'm an international student. Can I find jobs that sponsor visas?",
    a: "Yes. Jobs that say they sponsor visas are marked, and there's a daily list of them. Always confirm sponsorship with the employer before you apply.",
  },
  { q: "Is my resume private?", a: "The free resume check never stores your resume. Suggested changes are tied to your real experience; nothing is invented." },
  {
    q: "I'm a career advisor. Can I use Rolearch with students?",
    a: "Yes. Download the advisor handout below, run the 45-minute workshop with a class, or list Rolearch on your resources page with your school's link.",
  },
];

const btn = "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-200";

/** The page career centers, faculty and student groups link to: what students can do, and what advisors can use. */
export default function StudentsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          breadcrumbs([["Students", "/students"]]),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">For students and new grads</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">Find the jobs you already fit.</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-pretty text-muted">
        Rolearch reads millions of job postings and the skills each one asks for. See which jobs and internships your experience qualifies you for,
        what&apos;s missing, and what to learn next. Free for students.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/signup?next=%2Fjobs%3Flevel%3Dentry" className={`${btn} bg-ink text-paper hover:bg-ink-hover`}>
          Create your free account
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link href="/ats" className={`${btn} border border-ink/25 hover:border-ink`}>
          Check your resume against a job
        </Link>
      </div>

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.02em]">Start here</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
            <span className="grid size-8 place-items-center rounded-full bg-signal text-sm font-semibold text-ink tabular-nums">{i + 1}</span>
            <p className="mt-3 font-semibold">{s.title}</p>
            <p className="mt-1 flex-1 text-sm text-pretty text-muted">{s.body}</p>
            <Link href={s.href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
              {s.cta}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.02em]">Browse without an account</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {BROWSE.map((b) => (
          <li key={b.href}>
            <Link href={b.href} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm transition-colors duration-200 hover:border-ink">
              {b.label}
            </Link>
          </li>
        ))}
      </ul>

      <section id="advisors" aria-labelledby="advisors-h" className="mt-16 scroll-mt-24 border-t border-ink pt-10">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          <GraduationCap aria-hidden="true" className="size-4" />
          For career advisors and faculty
        </p>
        <h2 id="advisors-h" className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] text-balance">Use Rolearch with your students.</h2>
        <p className="mt-3 max-w-[62ch] text-pretty text-muted">
          Free tools for appointments, classes and workshops: every job-fit result is grounded in live postings, so you and the student start from the
          same evidence.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href="/students/rolearch-advisor-handout.pdf" download className={`${btn} bg-ink text-paper hover:bg-ink-hover`}>
            <Download aria-hidden="true" className="size-4" />
            Download the advisor handout (PDF)
          </a>
          <a href="mailto:savankumar@rolearch.com?subject=Rolearch%20for%20our%20students" className={`${btn} border border-ink/25 hover:border-ink`}>
            <Mail aria-hidden="true" className="size-4" />
            Ask for a workshop
          </a>
        </div>

        <h3 className="mt-12 font-display text-xl font-semibold tracking-[-0.02em]">A 45-minute class workshop</h3>
        <p className="mt-1 text-sm text-muted">Students bring a resume (a draft is fine) and a laptop or phone.</p>
        <ol className="mt-5 divide-y divide-line border-y border-line">
          {WORKSHOP.map((w) => (
            <li key={w.title} className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
              <span className="text-sm font-semibold text-signal-ink tabular-nums">{w.min}</span>
              <div>
                <p className="font-semibold">{w.title}</p>
                <p className="mt-0.5 max-w-[64ch] text-sm text-pretty text-muted">{w.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h3 className="mt-12 font-display text-xl font-semibold tracking-[-0.02em]">Link from your resources page</h3>
        <p className="mt-1 max-w-[62ch] text-sm text-pretty text-muted">
          Add your school&apos;s name to get a link for your website or newsletter. It lets us tell you how many of your students used Rolearch; it
          doesn&apos;t identify anyone.
        </p>
        <div className="mt-5 max-w-xl">
          <SchoolLink />
        </div>
      </section>

      <section aria-labelledby="faq-h" className="mt-16">
        <h2 id="faq-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">Questions</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 max-w-[70ch] text-pretty text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
