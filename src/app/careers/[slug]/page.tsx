import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { roadmapEntry } from "@/lib/roadmaps";
import { SkillTestLinks as Tests } from "@/components/skill-test-links";
import { linksFrom, roleName, roleProfile } from "@/lib/skill-graph";

type Props = { params: Promise<{ slug: string }> };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const year = new Date().getFullYear();
const ld = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [entry, profile] = await Promise.all([roadmapEntry(slug), roleProfile(slug)]);
  if (!entry || !profile) return { robots: { index: false } };
  const top = profile.skills.slice(0, 3).map((s) => s.skill.toLowerCase());
  return {
    title: `${entry.role} skills in ${year}: what employers ask for`,
    description: `Measured from ${profile.jobs.toLocaleString("en-US")} current ${entry.role} job postings: the most-asked skills${top.length ? ` (${top.join(", ")}…)` : ""}, how often each appears, and the roles they lead to.`,
    alternates: { canonical: `/careers/${slug}` },
  };
}

/** A measured role: the skills its current job postings ask for, and the roles those skills carry over to. */
export default function CareerPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-4xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Career params={params} />
    </Suspense>
  );
}

async function Career({ params }: Props) {
  const { slug } = await params;
  const [entry, profile, links] = await Promise.all([roadmapEntry(slug), roleProfile(slug), linksFrom(slug)]);
  if (!entry || !profile) notFound();
  const role = entry.role;
  const skills = profile.skills.slice(0, 15);
  const top = Math.max(...skills.map((s) => s.share), 0.01);
  const next = await Promise.all(links.slice(0, 8).map(async (l) => ({ ...l, name: await roleName(l.to_slug) })));
  const jobs = profile.jobs.toLocaleString("en-US");
  const listed = skills.slice(0, 5).map((s) => `${s.skill} (${pct(s.share)})`);

  const faq = [
    {
      q: `What skills does a ${role} need?`,
      a: `In ${jobs} current ${role} job postings, the skills asked for most often are ${listed.join(", ")}. Percentages are the share of postings that mention each skill.`,
    },
    ...(next.length
      ? [
          {
            q: `What jobs can a ${role} move into?`,
            a: `Measured by shared skill demand, the closest roles are ${next
              .slice(0, 4)
              .map((n) => n.name)
              .join(", ")}. ${next[0].name} shares skills such as ${next[0].shared.slice(0, 3).join(", ")}.`,
          },
        ]
      : []),
  ];

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Career paths", item: "https://www.rolearch.com/careers" },
                { "@type": "ListItem", position: 2, name: role, item: `https://www.rolearch.com/careers/${slug}` },
              ],
            },
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/careers" className="hover:text-ink">
          Career paths
        </Link>{" "}
        / <span>{role}</span>
      </nav>
      <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Measured from live jobs</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{role} skills employers ask for</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted text-pretty">
        From {jobs} open {role} job postings on Rolearch, read and tagged skill by skill. Updated every night as jobs open and close.
      </p>

      <section aria-labelledby="skills-h" className="mt-10">
        <h2 id="skills-h" className="font-display text-2xl font-semibold">
          The most-asked skills
        </h2>
        <p className="mt-1 text-sm text-muted">Share of {role} postings that mention each skill.</p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {skills.map((s) => (
            <li key={s.skill} className="grid grid-cols-[minmax(7rem,12rem)_1fr_3rem] items-center gap-3 text-[0.95rem]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{s.skill}</span>
                {s.lift >= 3 && <span className="shrink-0 rounded-full bg-signal/20 px-1.5 text-[0.7rem] font-semibold text-signal-ink">distinctive</span>}
              </span>
              <span className="h-2.5 rounded-full bg-ink-soft">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.share / top) * 100}%` }} />
              </span>
              <span className="text-end tabular-nums">{pct(s.share)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">&ldquo;Distinctive&rdquo; means {role} postings ask for it at least three times as often as jobs overall.</p>
        <Tests skills={skills.map((s) => s.skill)} />
      </section>

      {next.length > 0 && (
        <section aria-labelledby="next-h" className="mt-12">
          <h2 id="next-h" className="font-display text-2xl font-semibold">
            Where {role} skills carry over
          </h2>
          <p className="mt-1 text-sm text-muted">Roles whose postings ask for the most similar skills. Overlap counts the skills that define each role most.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {next.map((n) => (
              <li key={n.to_slug}>
                <Link
                  href={`/careers/${slug}/to/${n.to_slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{n.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{pct(n.score)} overlap</span>
                  </span>
                  <span className="mt-1 text-sm text-muted">Shared: {n.shared.slice(0, 4).join(", ")}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
                    How to switch
                    <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="faq-h" className="mt-12">
        <h2 id="faq-h" className="font-display text-2xl font-semibold">
          Questions
        </h2>
        <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {faq.map((f) => (
            <div key={f.q} className="p-4">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12 rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-balance">See how your resume matches {role} jobs</h2>
        <p className="mt-2 max-w-[56ch] text-[#dfe5ec]">Free: a job-fit check against any posting, the skills you&rsquo;re missing, and a step-by-step roadmap.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/ats" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-signal px-6 font-medium text-ink hover:bg-[#ebb877]">
            Check my fit free
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={`/roadmaps/${slug}`} className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-6 font-medium hover:border-signal">
            {role} roadmap
          </Link>
          <Link href={`/jobs?q=${encodeURIComponent(role)}`} className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-6 font-medium hover:border-signal">
            {role} jobs
          </Link>
        </div>
      </section>
    </article>
  );
}

