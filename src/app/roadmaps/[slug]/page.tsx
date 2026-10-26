import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoadmapViewer } from "@/components/roadmap-viewer";
import { loadViewer } from "@/lib/profile";
import { roadmapList } from "@/lib/roadmaps";

export async function generateMetadata({ params }: PageProps<"/roadmaps/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = (await roadmapList()).find((r) => r.slug === slug);
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
  const entry = (await roadmapList()).find((r) => r.slug === slug);
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
