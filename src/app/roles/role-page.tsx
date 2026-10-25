import { ArrowRight, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { JobRow } from "@/components/job-row";
import { searchJobs, type JobQuery } from "@/data/db";
import { formatJobCount } from "@/lib/job-query";
import { findPlace, findRole, heading, METROS, ROLES, SPECIAL, stats, type Place, type Role } from "@/lib/seo-pages";

const PER_PAGE = 30;
// Search matches descriptions too; the page lists jobs whose title names the role, from a wider first pull.
const PULL = 100;

/** The newest US jobs for a role (and place), kept for an hour. */
async function listing(roleSlug: string, placeSlug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  const r = findRole(roleSlug)!;
  const p = placeSlug ? findPlace(placeSlug) : undefined;
  const f: JobQuery = { q: r.q, cat: "all", where: "anywhere", remote: p?.kind === "remote", visa: p?.kind === "visa", pay: false, level: "any", sort: "match", country: "US" };
  const near = p?.kind === "metro" ? { lat: p.lat, lon: p.lon, only: true } : null;
  const { jobs, total } = await searchJobs(f, 1, PULL, near);
  const words = r.q.toLowerCase().split(/\s+/).filter(Boolean);
  // Role words are plain letters ("data engineer", "hvac"), so they're safe inside a pattern.
  const titled = jobs.filter((j) => words.every((w) => new RegExp(`\\b${w}`, "i").test(j.title)));
  return { total, jobs: (titled.length >= 5 ? titled : jobs).slice(0, PER_PAGE) };
}

const where = (p?: Place) => (!p ? "across the US" : p.kind === "metro" ? `in and around ${p.name}, ${p.state}` : p.kind === "remote" ? "you can do remotely" : "where the employer sponsors visas");

const path = (r: Role, p?: Place) => `/roles/${r.slug}${p ? `/${p.slug}` : ""}`;

/** The same search on the full jobs page, with every filter. */
function searchLink(r: Role, p?: Place) {
  const sp = new URLSearchParams({ q: r.q, sort: "newest" });
  if (p?.kind === "remote") sp.set("remote", "1");
  if (p?.kind === "visa") sp.set("visa", "1");
  if (p?.kind === "metro") sp.set("q", `${r.q} ${p.name}`);
  return `/jobs?${sp}`;
}

export async function roleMetadata(roleSlug: string, placeSlug = ""): Promise<Metadata> {
  const r = findRole(roleSlug);
  const p = placeSlug ? findPlace(placeSlug) : undefined;
  if (!r || (placeSlug && !p)) return { robots: { index: false } };
  const { total } = await listing(r.slug, p?.slug ?? "");
  const title = heading(r, p);
  return {
    title,
    description: `${formatJobCount(total)} open ${r.name} jobs ${where(p)}, straight from employers' own career sites. No staffing agencies, no reposts. Check your resume against any of them for free.`,
    alternates: { canonical: path(r, p) },
    // Thin pages help nobody: only pages with real listings are offered to search engines.
    robots: total >= 3 ? undefined : { index: false },
  };
}

export async function RolePage({ roleSlug, placeSlug = "" }: { roleSlug: string; placeSlug?: string }) {
  const r = findRole(roleSlug);
  const p = placeSlug ? findPlace(placeSlug) : undefined;
  if (!r || (placeSlug && !p)) return null;
  const { jobs, total } = await listing(r.slug, p?.slug ?? "");
  const s = stats(jobs);
  const near = p?.kind === "metro" ? METROS.filter((m) => m.kind === "metro" && m.state === p.state && m.slug !== p.slug) : [];
  const otherPlaces = [...near, ...METROS.filter((m) => !near.includes(m) && m.slug !== p?.slug)].slice(0, 12);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/roles" className="hover:text-ink">Jobs by role</Link>
        {" / "}
        {p ? <Link href={path(r)} className="hover:text-ink">{r.name}</Link> : <span>{r.name}</span>}
        {p && <> / <span>{p.kind === "metro" ? `${p.name}, ${p.state}` : p.name}</span></>}
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{heading(r, p)}</h1>
      <p className="mt-3 max-w-[65ch] text-lg text-muted">
        {total > 0
          ? `${formatJobCount(total)} open ${r.name} jobs ${where(p)}, straight from employers' own career sites. No staffing agencies, no reposts. Updated every few hours.`
          : `No open ${r.name} jobs ${where(p)} right now. New jobs arrive every few hours; see nearby places and related roles below.`}
      </p>

      <Link
        href="/ats"
        className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-ink p-4 text-paper transition-colors hover:bg-ink-hover sm:p-5"
      >
        <span className="flex items-start gap-3">
          <ScanSearch aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal" />
          <span>
            <span className="block font-display font-semibold">Will your resume get past the filter?</span>
            <span className="block text-sm text-[#c9d2de]">Free ATS check for any of these jobs: match score, missing keywords and the screening questions that knock people out.</span>
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>

      {(s.pay || s.employers.length > 0) && total > 0 && (
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          {s.pay && (
            <div className="rounded-2xl border border-line p-4">
              <dt className="text-sm text-muted">Typical posted pay</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">{s.pay}</dd>
              <dd className="text-xs text-muted">Median of the newest listings that show pay</dd>
            </div>
          )}
          {s.employers.length > 0 && (
            <div className="rounded-2xl border border-line p-4 sm:col-span-2">
              <dt className="text-sm text-muted">Hiring most right now</dt>
              <dd className="mt-1 text-[0.95rem]">{s.employers.map((e) => e.name).join(" · ")}</dd>
              {s.cities.length > 1 && p?.kind !== "metro" && <dd className="mt-2 text-sm text-muted">Top places: {s.cities.join(", ")}</dd>}
            </div>
          )}
        </dl>
      )}

      {jobs.length > 0 && (
        <section aria-labelledby="newest" className="mt-8">
          <h2 id="newest" className="font-display text-2xl font-semibold tracking-[-0.02em]">Open {r.name} jobs</h2>
          <div className="mt-3 divide-y divide-line">
            {jobs.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </div>
          {total > jobs.length && (
            <Link href={searchLink(r, p)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-ink hover:text-paper">
              See all {formatJobCount(total)} jobs
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </section>
      )}

      <section aria-labelledby="more" className="mt-12 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 id="more" className="font-semibold">{r.name} jobs elsewhere</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {[...SPECIAL.filter((x) => x.slug !== p?.slug), ...otherPlaces].map((x) => (
              <li key={x.slug}>
                <Link href={path(r, x)} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 hover:border-ink">
                  {x.kind === "metro" ? `${x.name}, ${x.state}` : x.kind === "remote" ? "Remote" : "Visa sponsorship"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Other roles {p ? (p.kind === "metro" ? `in ${p.name}` : p.kind === "remote" ? "you can do remotely" : "with visa sponsorship") : "across the US"}</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {ROLES.filter((x) => x.slug !== r.slug)
              .slice(0, 24)
              .map((x) => (
                <li key={x.slug}>
                  <Link href={path(x, p)} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 hover:border-ink">
                    {x.name}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
