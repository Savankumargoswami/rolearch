import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FitEvidence } from "@/components/fit-evidence";
import { HomeShowcase } from "@/components/home-showcase";
import { CANDIDATE_FEATURES, EMPLOYER_FEATURES, FAQ, NOT_OFFERED, type Feature } from "@/lib/features";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything Rolearch does: job-fit intelligence, evidence-based resume tailoring and cover letters, proctored skill tests with verified badges, jobs ranked by fit, career roadmaps, an AI application manager, interview preparation, and hiring tools for employers.",
  alternates: { canonical: "/features" },
};

/** Public overview of the whole product, for people and for search engines. */
export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Rolearch features</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">Understand your fit before you apply.</h1>
      <p className="mt-3 max-w-[64ch] text-lg text-muted">
        Rolearch is a career intelligence and job application platform. It connects your real experience to real job requirements, helps you prove
        your skills, and keeps every application organised, with tools for employers to hire on evidence.
      </p>

      <div className="-mx-4 sm:-mx-6">
        <HomeShowcase />
      </div>

      <h2 className="mt-16 font-display text-3xl font-semibold tracking-[-0.02em]">Everything for job seekers</h2>
      <ul className="mt-6 grid gap-5 md:grid-cols-2">
        {CANDIDATE_FEATURES.map((f) => (
          <li key={f.id}>
            <Card f={f} />
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-3xl font-semibold tracking-[-0.02em]">For employers</h2>
      <ul className="mt-6 grid gap-5 md:grid-cols-2">
        {EMPLOYER_FEATURES.map((f) => (
          <li key={f.id}>
            <Card f={f} />
          </li>
        ))}
      </ul>

      <section aria-labelledby="faq-h" className="mt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }).replace(/</g, "\\u003c"),
          }}
        />
        <h2 id="faq-h" className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Questions about Rolearch
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-balance">{f.q}</dt>
              <dd className="mt-1.5 text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <FitEvidence />

      <section className="mt-14 rounded-3xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl font-semibold">What Rolearch doesn&apos;t do</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-muted">
          {NOT_OFFERED.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 font-medium text-paper hover:bg-ink-hover">
          Create your free profile
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link href="/ats" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/25 px-6 font-medium hover:border-ink">
          Check your fit for a job
        </Link>
      </div>
    </div>
  );
}

function Card({ f }: { f: Feature }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h3 className="font-display text-xl font-semibold">{f.name}</h3>
      <p className="mt-1 text-muted">{f.summary}</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-[0.95rem]">
        {f.points.map((p) => (
          <li key={p} className="flex gap-2">
            <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-signal-ink" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link href={f.href} className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium underline underline-offset-4">
        Open
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Link>
    </article>
  );
}
