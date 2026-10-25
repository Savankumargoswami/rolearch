import type { Metadata } from "next";
import Link from "next/link";
import { METROS, ROLES, SPECIAL } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Jobs by role and city",
  description: "Browse US jobs by role and city, remote jobs and jobs with visa sponsorship, straight from employers' own career sites. No staffing agencies, no reposts.",
  alternates: { canonical: "/roles" },
};

export default function RolesHub() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Jobs by role and city</h1>
      <p className="mt-3 max-w-[65ch] text-lg text-muted">Every job comes straight from the employer&apos;s own career site. No staffing agencies, no reposts.</p>
      <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <li key={r.slug}>
            <Link href={`/roles/${r.slug}`} className="font-semibold hover:underline">{r.name} jobs</Link>
            <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
              {[...SPECIAL, ...METROS.slice(0, 6)].map((p) => (
                <Link key={p.slug} href={`/roles/${r.slug}/${p.slug}`} className="hover:text-ink">
                  {p.kind === "metro" ? p.name : p.kind === "remote" ? "Remote" : "Visa sponsorship"}
                </Link>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
