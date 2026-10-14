// Jobs from Supabase, read through its REST API with the public (publishable) key.
// Row-level security lets that key read open jobs only. Results are cached and
// refreshed hourly in the background; if Supabase isn't configured or reachable,
// the saved feed file (or the sample jobs) is used instead.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import feed from "./feed.json";
import { sampleJobs } from "./sample-jobs";
import type { Job, Level, Region, Workplace } from "./types";

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
};

const COLUMNS =
  "id,title,company,city,country,country_code,region,workplace,visa,salary_min,salary_max,salary_currency,salary_period," +
  "level,years,skills,summary,source,job_url,apply_url,lat,lon,posted_at,last_seen_at";

export type JobFeed = { jobs: Job[]; updatedAt: string | null; companies: number; countries: number; source: "supabase" | "file" | "sample" };

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
  };
}

async function fromSupabase(): Promise<JobFeed | null> {
  if (!URL || !KEY) return null;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${URL}/rest/v1/jobs?select=${COLUMNS}&status=eq.open&launch_field=eq.true&order=posted_at.desc.nullslast,id`,
      { headers: { apikey: KEY, "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` } },
    );
    if (!res.ok) throw new Error(`Supabase jobs request failed: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (rows.length === 0) return null;
  const now = Date.now();
  const jobs = rows.map((r) => toJob(r, now));
  return {
    jobs,
    updatedAt: rows.reduce((max, r) => (r.last_seen_at > max ? r.last_seen_at : max), rows[0].last_seen_at),
    companies: new Set(jobs.map((j) => j.company)).size,
    countries: new Set(jobs.map((j) => j.countryCode).filter(Boolean)).size,
    source: "supabase",
  };
}

function fromFile(): JobFeed {
  const live = feed.jobs as unknown as Job[];
  if (live.length > 0) {
    return { jobs: live, updatedAt: feed.generatedAt, companies: feed.companies, countries: feed.countries, source: "file" };
  }
  return {
    jobs: sampleJobs,
    updatedAt: null,
    companies: new Set(sampleJobs.map((j) => j.company)).size,
    countries: new Set(sampleJobs.map((j) => j.country)).size,
    source: "sample",
  };
}

/** Open data/ML jobs, newest first. Cached for an hour; refreshed in the background after that. */
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

export async function getJob(id: string): Promise<Job | undefined> {
  return (await getJobFeed()).jobs.find((j) => j.id === id);
}
