import { ArrowRight, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { howMany, jobPlace, pay, searchUrl, SITE, todayDigest, TOPICS } from "@/lib/daily-post";

// Public pages for the daily Rolearch posts, so they can be shared anywhere (the members' feed is private).

export async function generateMetadata({ params }: PageProps<"/today/[topic]">): Promise<Metadata> {
  const { topic: key } = await params;
  const topic = TOPICS.find((t) => t.key === key);
  if (!topic) return { robots: { index: false } };
  const d = await todayDigest(topic.key).catch(() => null);
  const line = d ? `${howMany(topic, d)}, posted in the last 24 hours on employers' own career sites.` : "";
  return {
    title: topic.title,
    description: `${line} No staffing agencies, no reposts. Updated every hour.`.trim(),
    alternates: { canonical: `/today/${topic.key}` },
  };
}

export default function Page({ params }: PageProps<"/today/[topic]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-3xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/today/[topic]">["params"] }) {
  const { topic: key } = await params;
  const topic = TOPICS.find((t) => t.key === key);
  if (!topic) notFound();
  const d = await todayDigest(topic.key).catch(() => null);
  const cities = (d?.cities ?? []).filter((c) => !/^(united states|usa|us)$/i.test(c));
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-medium tracking-wide text-signal-ink uppercase">Rolearch daily</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{topic.title}</h1>
      {d && d.total > 0 ? (
        <>
          <p className="mt-3 max-w-[60ch] text-lg text-muted">
            {howMany(topic, d)}, posted in the last 24 hours on employers&apos; own career sites. No staffing agencies, no reposts.
          </p>
          <h2 className="mt-8 font-display text-2xl font-semibold tracking-[-0.02em]">Picks</h2>
          <ul className="mt-3 divide-y divide-line">
            {d.jobs.slice(0, 6).map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex flex-col gap-0.5 rounded-xl px-3 py-3 hover:bg-surface">
                  <span className="font-semibold">{j.title}</span>
                  <span className="text-sm text-muted">{[j.company, jobPlace(j), pay(j)].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
          {(d.skills.length > 2 || cities.length > 2) && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {d.skills.length > 2 && (
                <div className="rounded-2xl border border-line p-4">
                  <dt className="text-sm text-muted">Most requested skills</dt>
                  <dd className="mt-1">{d.skills.slice(0, 8).join(", ")}</dd>
                </div>
              )}
              {cities.length > 2 && topic.key !== "remote" && (
                <div className="rounded-2xl border border-line p-4">
                  <dt className="text-sm text-muted">Hiring most in</dt>
                  <dd className="mt-1">{cities.slice(0, 5).join(", ")}</dd>
                </div>
              )}
            </dl>
          )}
          <Link href={searchUrl(topic).replace(SITE, "")} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-ink hover:text-paper">
            See all {topic.noun}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </>
      ) : (
        <p className="mt-3 text-lg text-muted">Today&apos;s list is being put together. Check back in a little while.</p>
      )}

      <Link href="/ats" className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-ink p-4 text-paper transition-colors hover:bg-ink-hover sm:p-5">
        <span className="flex items-start gap-3">
          <ScanSearch aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal" />
          <span>
            <span className="block font-display font-semibold">Will your resume get past the filter?</span>
            <span className="block text-sm text-[#c9d2de]">Free ATS check: match score, missing keywords and the screening questions that knock people out.</span>
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>

      <nav aria-label="Other daily lists" className="mt-10">
        <h2 className="font-semibold">Other daily lists</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {TOPICS.filter((t) => t.key !== topic.key).map((t) => (
            <li key={t.key}>
              <Link href={`/today/${t.key}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 hover:border-ink">
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
