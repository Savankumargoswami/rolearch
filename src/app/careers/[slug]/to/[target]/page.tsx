import { ArrowRight, Repeat2, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkillTestLinks } from "@/components/skill-test-links";
import { roadmapEntry } from "@/lib/roadmaps";
import { linksFrom, roleProfile } from "@/lib/skill-graph";

type Props = { params: Promise<{ slug: string; target: string }> };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ld = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

/** Both roles, the measured link between them, and what carries over / what to learn, or null if there's no link. */
async function load(slug: string, target: string) {
  const [from, to, a, b, links] = await Promise.all([roadmapEntry(slug), roadmapEntry(target), roleProfile(slug), roleProfile(target), linksFrom(slug)]);
  const link = links.find((l) => l.to_slug === target);
  if (!from || !to || !a || !b || !link) return null;
  const inA = new Map(a.skills.map((s) => [s.skill, s.share]));
  const inB = new Map(b.skills.map((s) => [s.skill, s.share]));
  const carry = link.shared.map((skill) => ({ skill, a: inA.get(skill) ?? 0, b: inB.get(skill) ?? 0 }));
  // To learn: what the target's postings ask for that the current role's postings rarely do.
  const learn = b.skills
    .filter((s) => s.share >= 0.08 && (inA.get(s.skill) ?? 0) < s.share / 2 && !link.shared.includes(s.skill))
    .slice(0, 8)
    .map((s) => ({ skill: s.skill, a: inA.get(s.skill) ?? 0, b: s.share }));
  return { from: from.role, to: to.role, a, b, link, carry, learn };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, target } = await params;
  const d = await load(slug, target);
  if (!d) return { robots: { index: false } };
  return {
    title: `${d.from} to ${d.to}: skills that carry over and what to learn`,
    description: `Can a ${d.from.toLowerCase()} become a ${d.to.toLowerCase()}? Measured from ${(d.a.jobs + d.b.jobs).toLocaleString("en-US")} job postings: ${pct(d.link.score)} skill overlap, the skills you already have, and the ones to add.`,
    alternates: { canonical: `/careers/${slug}/to/${target}` },
  };
}

/** A measured career move: from one role to another, using the skills both roles' live postings ask for. */
export default function SwitchPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-4xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Switch params={params} />
    </Suspense>
  );
}

function Compare({ rows, from, to }: { rows: { skill: string; a: number; b: number }[]; from: string; to: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-3 border-b border-line px-4 py-2 text-xs font-semibold text-muted">
        <span>Skill</span>
        <span className="truncate text-end" title={from}>
          {from}
        </span>
        <span className="truncate text-end" title={to}>
          {to}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.skill} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-3 px-4 py-2.5 text-[0.95rem]">
            <span className="font-medium">{r.skill}</span>
            <span className="text-end tabular-nums text-muted">{r.a ? pct(r.a) : "–"}</span>
            <span className="text-end font-semibold tabular-nums">{r.b ? pct(r.b) : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Switch({ params }: Props) {
  const { slug, target } = await params;
  const d = await load(slug, target);
  if (!d) notFound();
  const { from, to, link, carry, learn } = d;
  const strength = link.score >= 0.5 ? "a close move" : link.score >= 0.3 ? "a realistic move with some upskilling" : "a stretch that needs new skills";
  const answer = `Yes, it's ${strength}. Measured across current postings, the two roles have ${pct(link.score)} skill overlap. Skills that carry over include ${carry
    .slice(0, 4)
    .map((c) => c.skill)
    .join(", ")}${learn.length ? `; the main skills to add are ${learn.slice(0, 4).map((l) => l.skill).join(", ")}` : ""}.`;

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [{ "@type": "Question", name: `Can a ${from} become a ${to}?`, acceptedAnswer: { "@type": "Answer", text: answer } }],
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Career paths", item: "https://www.rolearch.com/careers" },
                { "@type": "ListItem", position: 2, name: from, item: `https://www.rolearch.com/careers/${slug}` },
                { "@type": "ListItem", position: 3, name: `To ${to}`, item: `https://www.rolearch.com/careers/${slug}/to/${target}` },
              ],
            },
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/careers" className="hover:text-ink">
          Career paths
        </Link>{" "}
        /{" "}
        <Link href={`/careers/${slug}`} className="hover:text-ink">
          {from}
        </Link>{" "}
        / <span>To {to}</span>
      </nav>
      <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Career switch, measured</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        From {from} to {to}
      </h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted text-pretty">{answer}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="font-display text-3xl font-semibold tabular-nums">{pct(link.score)}</p>
          <p className="text-sm text-muted">skill overlap</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="font-display text-3xl font-semibold tabular-nums">{d.b.jobs.toLocaleString("en-US")}</p>
          <p className="text-sm text-muted">open {to} postings read</p>
        </div>
      </div>

      <section aria-labelledby="carry-h" className="mt-10">
        <h2 id="carry-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Repeat2 aria-hidden="true" className="size-6" />
          Skills that carry over
        </h2>
        <p className="mt-1 text-sm text-muted">Share of each role&rsquo;s postings that ask for the skill.</p>
        <Compare rows={carry} from={from} to={to} />
      </section>

      {learn.length > 0 && (
        <section aria-labelledby="learn-h" className="mt-10">
          <h2 id="learn-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Target aria-hidden="true" className="size-6" />
            Skills to add
          </h2>
          <p className="mt-1 text-sm text-muted">
            Asked for often in {to} postings, rarely in {from} ones.
          </p>
          <Compare rows={learn} from={from} to={to} />
          <SkillTestLinks skills={[...learn, ...carry].map((x) => x.skill)} />
        </section>
      )}

      <section className="mt-12 rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-balance">Plan your move to {to}</h2>
        <p className="mt-2 max-w-[56ch] text-[#dfe5ec]">
          The Career Gap Analyzer compares your own resume with {to} jobs and lays out the skills to close, free.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/gaps?role=${encodeURIComponent(to)}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-signal px-6 font-medium text-ink hover:bg-[#ebb877]">
            Find my gaps free
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={`/roadmaps/${target}`} className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-6 font-medium hover:border-signal">
            {to} roadmap
          </Link>
          <Link href={`/careers/${target}`} className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-6 font-medium hover:border-signal">
            All {to} skills
          </Link>
        </div>
      </section>
    </article>
  );
}
