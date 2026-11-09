import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoadmapViewer } from "@/components/roadmap-viewer";
import { loadViewer } from "@/lib/profile";
import { roadmapEntry, roadmapPreview } from "@/lib/roadmaps";
import { roleSkills } from "@/lib/skill-graph";

export async function generateMetadata({ params }: PageProps<"/roadmaps/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await roadmapEntry(slug);
  if (!entry) return { robots: { index: false } };
  return { title: `${entry.role} career roadmap`, description: entry.summary, alternates: { canonical: `/roadmaps/${slug}` } };
}

export default function RoadmapPage({ params }: PageProps<"/roadmaps/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: { params: PageProps<"/roadmaps/[slug]">["params"] }) {
  const { slug } = await params;
  const entry = await roadmapEntry(slug);
  if (!entry) notFound();
  const viewer = await loadViewer();
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/roadmaps" className="hover:text-ink">Career roadmaps</Link> / <span>{entry.role}</span>
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{entry.role} roadmap</h1>
      {viewer ? (
        <RoadmapViewer slug={slug} />
      ) : (
        <div className="mt-6">
          <p className="max-w-[65ch] text-lg">{entry.summary}</p>
          <GuestPreview slug={slug} role={entry.role} />
          <div className="mt-6 rounded-2xl bg-ink p-5 text-paper">
            <p className="font-display text-xl font-semibold">See the full roadmap free</p>
            <p className="mt-1 text-[#c9d2de]">Every stage from beginner to expert, with lessons, practice drills, projects, interview questions and free resources. Free with a Rolearch account.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/signup?next=${encodeURIComponent(`/roadmaps/${slug}`)}`} className="inline-flex min-h-11 items-center rounded-full bg-signal px-5 font-medium text-ink hover:bg-[#ebb877]">Create a free account</Link>
              <Link href={`/signin?next=${encodeURIComponent(`/roadmaps/${slug}`)}`} className="inline-flex min-h-11 items-center rounded-full border border-[#dfe5ec]/50 px-5 font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Visitors see the first stage in full, the measured skills employers ask for, and the size of the rest. */
async function GuestPreview({ slug, role }: { slug: string; role: string }) {
  const [preview, skills] = await Promise.all([roadmapPreview(slug), roleSkills(slug, 8)]);
  return (
    <>
      {preview && (
        <section aria-labelledby="stage1-h" className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Stage 1 of {preview.stages} · about {preview.first.weeks} weeks
          </p>
          <h2 id="stage1-h" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
            {preview.first.level}
          </h2>
          <p className="mt-1 max-w-[65ch] text-muted">{preview.first.goal}</p>
          <ol className="mt-5 flex flex-col gap-4">
            {preview.first.skills.map((k, i) => (
              <li key={k.name} className="grid grid-cols-[2rem_1fr] gap-x-2">
                <span className="font-display text-lg font-semibold tabular-nums text-signal-ink">{i + 1}</span>
                <div>
                  <p className="font-semibold">{k.name}</p>
                  <p className="text-[0.95rem] text-muted">{k.why}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted">
            {`Then ${preview.stages - 1} more stages (about ${preview.weeks} weeks in all) with lessons, drills, projects${preview.interview ? `, ${preview.interview} interview questions with strong answers` : ""} and free resources.`}
          </p>
        </section>
      )}
      {skills.length > 0 && (
        <section aria-labelledby="asked-h" className="mt-6">
          <h2 id="asked-h" className="font-display text-xl font-semibold">
            What {role} jobs ask for right now
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {skills.map((k) => (
              <li key={k.skill} className="rounded-full bg-ink-soft px-3 py-1 text-sm">
                {k.skill} <span className="tabular-nums text-muted">{Math.round(k.share * 100)}%</span>
              </li>
            ))}
          </ul>
          <Link href={`/careers/${slug}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
            See all measured {role} skills and where they lead
          </Link>
        </section>
      )}
    </>
  );
}
