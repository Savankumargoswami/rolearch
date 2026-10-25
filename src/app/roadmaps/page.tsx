import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RoadmapSearch } from "@/components/roadmap-search";
import { roadmapList } from "@/lib/roadmaps";

export const metadata: Metadata = {
  title: "Free career roadmaps",
  description: "Step-by-step roadmaps for hundreds of careers, from sales and nursing to engineering and the trades: what to learn, how to practice and free resources, built from U.S. Department of Labor occupation data.",
  alternates: { canonical: "/roadmaps" },
};

export default function RoadmapsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Free career roadmaps</h1>
      <p className="mt-3 max-w-[65ch] text-lg text-muted">
        From beginner to hired to expert, for hundreds of careers: the skills in order, short lessons, practice drills, projects, the
        licenses that matter and free resources, every link checked.
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  // Read at request time (not while building the site), so a busy database can't fail a deploy.
  await connection();
  const roles = await roadmapList();
  if (!roles.length) return <p className="mt-8 text-muted">Roadmaps are on their way. Check back soon.</p>;
  return <RoadmapSearch roles={roles.map(({ slug, role, depth }) => ({ slug, role, depth }))} />;
}
