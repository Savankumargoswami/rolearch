"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function RoadmapSearch({ roles }: { roles: { slug: string; role: string; depth: string }[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = roles.filter((r) => words.every((w) => r.role.toLowerCase().includes(w)));
  return (
    <div className="mt-8">
      <label className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-ink">
        <Search aria-hidden="true" className="size-5 text-muted" />
        <span className="sr-only">Find a career</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a career: nurse, sales, data engineer, electrician…" className="w-full bg-transparent outline-none" />
      </label>
      <p className="mt-3 text-sm text-muted">{shown.length} careers</p>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, 400).map((r) => (
          <li key={r.slug}>
            <Link href={`/roadmaps/${r.slug}`} className="inline-flex min-h-9 items-center hover:underline">
              {r.role}
              {r.depth === "deep" && <span className="ms-2 rounded-full bg-signal/20 px-2 text-xs font-medium text-signal-ink">In depth</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
