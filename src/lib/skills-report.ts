// The monthly Skills Report, from db/043_skill_trends.sql: skill demand across open job postings, overall and by
// industry, month over month.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

type Row = { month: string; category: string; skill: string; jobs: number; updated_at?: string };
export type SkillShare = { skill: string; jobs: number; share: number; prev: number | null };
export type Industry = { category: string; jobs: number; ai: number; top: SkillShare[] };
export type Report = { month: string; prevMonth: string | null; jobs: number; ai: number; top: SkillShare[]; rising: SkillShare[]; falling: SkillShare[]; industries: Industry[]; updatedAt: string };

async function rows(query: string): Promise<Row[]> {
  if (!BASE || !dataKey) return [];
  const out: Row[] = [];
  // PostgREST returns at most 1,000 rows per request; a month is a few thousand.
  for (let from = 0; from < 20000; from += 1000) {
    const res = await fetch(`${BASE}/rest/v1/skill_trends?select=month,category,skill,jobs,updated_at&${query}`, {
      headers: { apikey: dataKey, Range: `${from}-${from + 999}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const page = (await res.json()) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/** Months with a report, newest first ("2026-11"). */
export async function reportMonths(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("skills-report");
  const r = await rows("category=eq.all&skill=eq.*&order=month.desc");
  return r.map((x) => x.month.slice(0, 7));
}

export async function skillsReport(month: string): Promise<Report | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("skills-report");
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const months = await reportMonths();
  const i = months.indexOf(month);
  if (i < 0) return null;
  const prevMonth = months[i + 1] ?? null;
  const [cur, prev] = await Promise.all([rows(`month=eq.${month}-01&order=jobs.desc`), prevMonth ? rows(`month=eq.${prevMonth}-01&category=eq.all`) : []]);
  if (!cur.length) return null;

  const total = (cat: string, list: Row[]) => list.find((r) => r.category === cat && r.skill === "*")?.jobs ?? 0;
  const jobs = total("all", cur);
  const prevJobs = total("all", prev);
  const prevShare = new Map(prev.filter((r) => r.skill !== "*" && r.skill !== "ai").map((r) => [r.skill, prevJobs ? r.jobs / prevJobs : 0]));
  const shares = (cat: string, n: number): SkillShare[] =>
    cur
      .filter((r) => r.category === cat && r.skill !== "*" && r.skill !== "ai")
      .map((r) => ({ skill: r.skill, jobs: r.jobs, share: n ? r.jobs / n : 0, prev: cat === "all" && prevMonth ? (prevShare.get(r.skill) ?? 0) : null }));

  const all = shares("all", jobs);
  // Rising and falling: change in share, among skills at least 1% of postings ask for.
  const moved = all.filter((s) => s.prev !== null && Math.max(s.share, s.prev) >= 0.01).sort((a, b) => b.share - b.prev! - (a.share - a.prev!));
  const industries = [...new Set(cur.map((r) => r.category))]
    .filter((c) => c !== "all" && c !== "other")
    .map((category) => {
      const n = total(category, cur);
      return { category, jobs: n, ai: n ? (cur.find((r) => r.category === category && r.skill === "ai")?.jobs ?? 0) / n : 0, top: shares(category, n).slice(0, 5) };
    })
    .filter((x) => x.jobs >= 200)
    .sort((a, b) => b.ai - a.ai);

  return {
    month,
    prevMonth,
    jobs,
    ai: jobs ? (cur.find((r) => r.category === "all" && r.skill === "ai")?.jobs ?? 0) / jobs : 0,
    top: all.slice(0, 25),
    rising: moved.slice(0, 8).filter((s) => s.share > s.prev!),
    falling: moved.slice(-8).reverse().filter((s) => s.share < s.prev!),
    industries,
    updatedAt: cur[0].updated_at ?? `${month}-01`,
  };
}

export const monthName = (month: string) => new Date(`${month}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
