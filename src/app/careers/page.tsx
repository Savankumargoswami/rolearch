import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { roadmapList } from "@/lib/roadmaps";
import { measuredRoles } from "@/lib/skill-graph";

export const metadata: Metadata = {
  title: "Career paths: the skills every role asks for, measured from live jobs",
  description:
    "For hundreds of roles across every industry: the skills current job postings ask for, how often, and which roles those skills carry over to. Updated nightly from live jobs.",
  alternates: { canonical: "/careers" },
};

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Measured from live jobs</p>
      <h1 className="mt-1 max-w-[22ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        What every role asks for, and where it leads
      </h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted text-pretty">
        Rolearch reads every job posting it lists and tags the skills each one asks for. Pick a role to see its most-asked skills and the roles those
        skills carry over to. See the trends in the{" "}
        <Link href="/reports/skills" className="font-medium text-ink underline underline-offset-4">
          monthly Skills Report
        </Link>
        .
      </p>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <RoleList />
      </Suspense>
    </div>
  );
}

async function RoleList() {
  const [roles, list] = await Promise.all([measuredRoles(), roadmapList()]);
  const names = new Map(list.map((r) => [r.slug, r.role]));
  const rows = roles
    .filter((r) => names.has(r.slug))
    .map((r) => ({ ...r, name: names.get(r.slug)! }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!rows.length) return <p className="mt-10 text-muted">The role data is being measured. Check back soon.</p>;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = /[a-z]/i.test(r.name[0]) ? r.name[0].toUpperCase() : "#";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="mt-10">
      <p className="text-sm text-muted">
        {rows.length} roles, {rows.reduce((n, r) => n + r.jobs, 0).toLocaleString("en-US")} job postings read
      </p>
      <div className="mt-4 columns-1 gap-8 sm:columns-2 lg:columns-3">
        {[...groups].map(([letter, items]) => (
          <section key={letter} className="mb-6 break-inside-avoid">
            <h2 className="font-display text-lg font-semibold text-signal-ink">{letter}</h2>
            <ul className="mt-1">
              {items.map((r) => (
                <li key={r.slug} className="flex items-baseline justify-between gap-3 py-1">
                  <Link href={`/careers/${r.slug}`} className="hover:underline hover:underline-offset-4">
                    {r.name}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{r.jobs.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
