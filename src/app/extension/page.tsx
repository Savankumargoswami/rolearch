import { ArrowRight, ArrowUpRight, Puzzle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CHROME_EXTENSION_URL } from "@/components/add-to-chrome";

export const metadata: Metadata = {
  title: "Chrome extension: check your fit on any job posting",
  description:
    "Rolearch: Job Fit Check is a free Chrome and Edge extension. Click it on any job posting (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday, Ashby or a company careers page) to see how your resume fits: your match, the skills you're missing and what to fix.",
  alternates: { canonical: "/extension" },
};

const SITES = ["LinkedIn", "Indeed", "Glassdoor", "Greenhouse", "Lever", "Workday", "Ashby", "Company careers pages"];

const STEPS = [
  { title: "Open any job posting", body: "On LinkedIn, Indeed, Glassdoor, an applicant-tracking site or a company's own careers page." },
  { title: "Click the Rolearch icon", body: "The extension reads that one posting: the title, company, link and description." },
  { title: "See your fit", body: "The posting opens in Rolearch's free job-fit check, already filled in. Add your resume to see your match, the missing skills and what to fix." },
];

const FAQ = [
  {
    q: "Does Rolearch have a Chrome extension?",
    a: "Yes. Rolearch: Job Fit Check is free on the Chrome Web Store and also installs in Microsoft Edge. Click it on any job posting to check how your resume fits that job.",
  },
  {
    q: "What can the extension read?",
    a: "Only the job posting on the tab you're looking at, and only when you click the Rolearch icon. It doesn't ask for permission to read all websites, and it doesn't track your browsing.",
  },
  { q: "Is it free?", a: "Yes. The extension and the job-fit check are free for job seekers." },
  { q: "Which browsers does it work in?", a: "Google Chrome, Microsoft Edge and other Chromium browsers on desktop. Browser extensions can't be installed on phones." },
];

/** Public page about the browser extension, so people and search engines can find it (the install buttons elsewhere only show in desktop Chromium). */
export default function ExtensionPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Rolearch: Job Fit Check",
      applicationCategory: "BrowserApplication",
      operatingSystem: "Chrome, Microsoft Edge",
      url: "https://www.rolearch.com/extension",
      downloadUrl: CHROME_EXTENSION_URL,
      description: metadata.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Rolearch", url: "https://www.rolearch.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Chrome and Edge extension</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">Check your fit on any job posting.</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-pretty text-muted">
        Rolearch: Job Fit Check is a free browser extension. One click on a job posting shows how your resume fits it: your match, the skills you're
        missing and what to fix, before you apply.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
        >
          <Puzzle aria-hidden="true" className="size-4" />
          Add to Chrome, free
          <ArrowUpRight aria-hidden="true" className="size-4" />
          <span className="sr-only">(opens the Chrome Web Store in a new tab)</span>
        </a>
        <Link
          href="/ats"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/25 px-5 text-sm font-medium transition-colors duration-200 hover:border-ink"
        >
          Or paste a job into the free check
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <p className="mt-3 text-sm text-muted">Works in Google Chrome and Microsoft Edge on desktop.</p>

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.02em]">How it works</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
            <span className="grid size-8 place-items-center rounded-full bg-signal text-sm font-semibold text-ink tabular-nums">{i + 1}</span>
            <p className="mt-3 font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-pretty text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.02em]">Works on</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {SITES.map((s) => (
          <li key={s} className="rounded-full border border-line px-3 py-1 text-sm">
            {s}
          </li>
        ))}
      </ul>

      <aside className="mt-14 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" strokeWidth={1.75} />
        <div>
          <p className="font-semibold">Private by design</p>
          <p className="mt-1 max-w-[64ch] text-sm text-pretty text-muted">
            The extension reads only the posting on the tab you're on, and only when you click it. It doesn't ask to read all websites and doesn't
            track your browsing. Your resume is checked on Rolearch, where the free check never stores it.
          </p>
        </div>
      </aside>

      <section aria-labelledby="faq-h" className="mt-14">
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
