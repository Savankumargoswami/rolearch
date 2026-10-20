// Jobs from Supabase, read through its REST API with the public (publishable) key.
// Row-level security lets that key read open jobs only. Results are cached and
// refreshed hourly in the background; if Supabase isn't configured or reachable,
// the saved feed file (or the sample jobs) is used instead.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import feed from "./feed.json";
import { sampleJobs } from "./sample-jobs";
import type { Job, JobLite, Level, Region, Workplace } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PAGE = 1000; // PostgREST's default max rows per request
const DAY = 86_400_000;

type Row = {
  id: string;
  title: string;
  company: string;
  city: string;
  country: string;
  country_code: string | null;
  region: Region;
  workplace: Workplace;
  visa: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: "year" | "month" | "hour" | null;
  level: Level;
  years: number;
  skills: string[];
  summary: string;
  source: string;
  job_url: string;
  apply_url: string;
  lat: number | null;
  lon: number | null;
  posted_at: string | null;
  last_seen_at: string;
  category: string;
  verified: boolean;
  company_domain: string | null;
};

const COLUMNS =
  "id,title,company,city,country,country_code,region,workplace,visa,salary_min,salary_max,salary_currency,salary_period," +
  "level,years,skills,summary,source,job_url,apply_url,lat,lon,posted_at,last_seen_at,category,verified,company_domain";
// The home page map, similar jobs and the sitemap use the newest jobs; search runs in the database.
const FEED_LIMIT = 2000;

export type JobFeed = { jobs: Job[]; total: number; updatedAt: string | null; companies: number; countries: number; source: "supabase" | "file" | "sample" };

function toJob(r: Row, now: number): Job {
  const posted = r.posted_at ? Date.parse(r.posted_at) : now;
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    city: r.city,
    country: r.country,
    countryCode: r.country_code,
    region: r.region,
    workplace: r.workplace,
    visa: r.visa,
    salary:
      r.salary_min != null && r.salary_max != null && r.salary_currency
        ? { min: Number(r.salary_min), max: Number(r.salary_max), currency: r.salary_currency, period: r.salary_period ?? "year" }
        : null,
    level: r.level,
    years: r.years,
    skills: r.skills ?? [],
    nice: [],
    postedAt: r.posted_at ?? undefined,
    postedDaysAgo: Math.max(0, Math.floor((now - posted) / DAY)),
    source: r.source,
    summary: r.summary,
    duties: [],
    jobUrl: r.job_url,
    applyUrl: r.apply_url,
    lat: r.lat,
    lon: r.lon,
    category: r.category,
    verified: r.verified,
    companyDomain: r.company_domain,
  };
}

async function fromSupabase(): Promise<JobFeed | null> {
  if (!URL || !KEY) return null;
  const rows: Row[] = [];
  for (let from = 0; from < FEED_LIMIT; from += PAGE) {
    const res = await fetch(
      `${URL}/rest/v1/jobs?select=${COLUMNS}&status=eq.open&order=posted_at.desc.nullslast,id`,
      // getJobFeed's "use cache" already caches the result; a second fetch-level cache only risks a stale or broken copy.
      { headers: { apikey: KEY, "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase jobs request failed: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (rows.length === 0) return null;
  const now = Date.now();
  const jobs = rows.map((r) => toJob(r, now));
  const stats = await rpc<{ jobs: number; companies: number; countries: number; updated_at: string }[]>("job_stats", {});
  return {
    jobs,
    total: Number(stats?.[0]?.jobs ?? jobs.length),
    updatedAt: stats?.[0]?.updated_at ?? rows[0].last_seen_at,
    companies: Number(stats?.[0]?.companies ?? new Set(jobs.map((j) => j.company)).size),
    countries: Number(stats?.[0]?.countries ?? new Set(jobs.map((j) => j.countryCode).filter(Boolean)).size),
    source: "supabase",
  };
}

function fromFile(): JobFeed {
  const live = feed.jobs as unknown as Job[];
  if (live.length > 0) {
    return { jobs: live, total: live.length, updatedAt: feed.generatedAt, companies: feed.companies, countries: feed.countries, source: "file" };
  }
  return {
    jobs: sampleJobs,
    total: sampleJobs.length,
    updatedAt: null,
    companies: new Set(sampleJobs.map((j) => j.company)).size,
    countries: new Set(sampleJobs.map((j) => j.country)).size,
    source: "sample",
  };
}

/** The newest open jobs (all fields), plus site-wide totals. Cached for an hour; refreshed in the background after that. */
export async function getJobFeed(): Promise<JobFeed> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  try {
    return (await fromSupabase()) ?? fromFile();
  } catch (e) {
    console.error("[jobs] falling back to the saved feed:", e);
    return fromFile();
  }
}

/** One job by id, straight from the database (any open job, not just the newest). */
export async function getJob(id: string): Promise<Job | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  if (URL && KEY && /^[\w.-]{1,160}$/.test(id)) {
    try {
      const res = await fetch(`${URL}/rest/v1/jobs?select=${COLUMNS}&id=eq.${encodeURIComponent(id)}&status=eq.open`, { headers: { apikey: KEY }, cache: "no-store" });
      if (res.ok) {
        const [row] = (await res.json()) as Row[];
        if (row) return toJob(row, Date.now());
      }
    } catch (e) {
      console.error("[jobs] job lookup failed:", e);
    }
  }
  return (await getJobFeed()).jobs.find((j) => j.id === id);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  if (!URL || !KEY) return null;
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[jobs] ${name} failed: ${res.status} ${await res.text()}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[jobs] ${name} failed:`, e);
    return null;
  }
}

export type JobQuery = {
  q: string;
  cat: string;
  where: string;
  remote: boolean;
  visa: boolean;
  pay: boolean;
  level: string;
  sort: "match" | "newest";
};

type SearchRow = Pick<Row, "id" | "title" | "company" | "city" | "country" | "region" | "workplace" | "visa" | "salary_min" | "salary_max" | "salary_currency" | "salary_period" | "level" | "years" | "skills" | "posted_at" | "category" | "verified" | "source" | "company_domain"> & { total: number };

/** Searches every open job in the database. Cached briefly per query so popular searches are instant. */
export async function searchJobs(f: JobQuery, page = 1, perPage = 40): Promise<{ jobs: JobLite[]; total: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("jobs");
  const rows = await rpc<SearchRow[]>("search_jobs", {
    q: f.q.slice(0, 100),
    cat: f.cat === "all" ? "" : f.cat,
    region_in: f.where === "anywhere" ? "" : f.where,
    remote_only: f.remote,
    visa_only: f.visa,
    pay_only: f.pay,
    lvl: f.level === "any" ? "" : f.level,
    sort: f.sort === "newest" ? "newest" : "relevance",
    lim: perPage,
    off: (Math.max(1, page) - 1) * perPage,
  });
  if (!rows) {
    // No database: search the saved feed instead.
    const { filterJobs, emptyFilters } = await import("@/lib/search");
    const all = filterJobs((await getJobFeed()).jobs, { ...emptyFilters, q: f.q });
    return { jobs: all.slice((page - 1) * perPage, page * perPage), total: all.length };
  }
  const now = Date.now();
  return {
    total: Number(rows[0]?.total ?? 0),
    jobs: rows.map((r) => {
      const posted = r.posted_at ? Date.parse(r.posted_at) : now;
      return {
        id: r.id,
        title: r.title,
        company: r.company,
        city: r.city,
        country: r.country,
        region: r.region,
        workplace: r.workplace,
        visa: r.visa,
        salary:
          r.salary_min != null && r.salary_max != null && r.salary_currency
            ? { min: Number(r.salary_min), max: Number(r.salary_max), currency: r.salary_currency, period: r.salary_period ?? "year" }
            : null,
        level: r.level,
        years: r.years,
        skills: r.skills ?? [],
        postedDaysAgo: Math.max(0, Math.floor((now - posted) / DAY)),
        category: r.category,
        verified: r.verified,
        companyDomain: r.company_domain,
        source: r.source,
      };
    }),
  };
}

/** How many open jobs each category has, for the browse chips. */
export async function jobCategories(): Promise<{ category: string; n: number }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  const rows = await rpc<{ category: string; n: number }[]>("job_categories", {});
  return (rows ?? []).map((r) => ({ category: r.category, n: Number(r.n) }));
}

/**
 * The job's full description as plain text, for matching and the ATS check (pages show the summary
 * and link to the employer's own posting). Falls back to the summary when there's no full text.
 */
export async function getJobText(id: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  const job = await getJob(id);
  const fallback = job ? [job.summary, ...job.duties].filter(Boolean).join("\n") : "";
  if (!URL || !KEY) return fallback;
  try {
    const res = await fetch(`${URL}/rest/v1/jobs?select=description&id=eq.${encodeURIComponent(id)}`, { headers: { apikey: KEY }, cache: "no-store" });
    if (!res.ok) return fallback;
    const [row] = (await res.json()) as { description: string }[];
    return row?.description || fallback;
  } catch {
    return fallback;
  }
}

export type MapPin = { city: string; country: string; lat: number; lon: number; n: number };

/** One pin per metro area with how many open jobs it has, for the home page map. */
export async function jobMap(): Promise<MapPin[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  const rows = await rpc<MapPin[]>("job_map", { max_pins: 80 });
  return (rows ?? []).map((r) => ({ ...r, n: Number(r.n) }));
}
