// Transferable skill intelligence, measured: which roles share skills, from Rolearch's own live jobs across every
// industry (db/040_skill_graph.sql rebuilds role_links and role_skill_stats nightly). A route from the member's role
// to their goal goes through the bridge role that shares the most with both; nearby roles are the closest measured
// neighbours. Until the data covers a role, the hand-written moves in transitions.ts are used instead.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { roadmapEntry, roadmapForTitle } from "./roadmaps";
import { transitionNetwork, type Route } from "./transitions";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

export type Link = { from_slug: string; to_slug: string; score: number; shared: string[] };
export type RoleSkill = { skill: string; share: number; lift: number };

async function get<T>(path: string): Promise<T | null> {
  if (!BASE || !dataKey) return null;
  try {
    const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: dataKey }, cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** A role's closest roles by shared skill demand, strongest first. */
export async function linksFrom(slug: string): Promise<Link[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("skill-graph");
  return (await get<Link[]>(`role_links?select=from_slug,to_slug,score,shared&from_slug=eq.${encodeURIComponent(slug)}&order=score.desc&limit=40`)) ?? [];
}

/** The skills that define a role in today's jobs: frequent there and more common than elsewhere. */
export async function roleSkills(slug: string, limit = 12): Promise<RoleSkill[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("skill-graph");
  const rows = (await get<RoleSkill[]>(`role_skill_stats?select=skill,share,lift&slug=eq.${encodeURIComponent(slug)}&order=share.desc&limit=40`)) ?? [];
  return rows
    .map((r) => ({ ...r, weight: r.share * Math.log1p(Math.max(r.lift, 0)) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ skill, share, lift }) => ({ skill, share, lift }));
}

/** Every measured role (30+ open jobs with skills) and its job count, biggest first. */
export async function measuredRoles(): Promise<{ slug: string; jobs: number }[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("skill-graph");
  return (await get<{ slug: string; jobs: number }[]>("role_totals?select=slug,jobs&order=jobs.desc&limit=2000")) ?? [];
}

/** One role's measured profile: job count and its skills by how often jobs ask for them (share of the role's jobs). */
export async function roleProfile(slug: string): Promise<{ jobs: number; skills: { skill: string; jobs: number; share: number; lift: number }[] } | null> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("skill-graph");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const [total, skills] = await Promise.all([
    get<{ jobs: number }[]>(`role_totals?select=jobs&slug=eq.${slug}`),
    get<{ skill: string; jobs: number; share: number; lift: number }[]>(`role_skill_stats?select=skill,jobs,share,lift&slug=eq.${slug}&order=share.desc&limit=40`),
  ]);
  if (!total?.[0]) return null;
  return { jobs: total[0].jobs, skills: skills ?? [] };
}

/** The strongest `perRole` career moves from every measured role (for the sitemap). */
export async function topLinks(perRole = 10): Promise<{ from: string; to: string }[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("skill-graph");
  if (!BASE || !dataKey) return [];
  const out: { from: string; to: string }[] = [];
  const seen = new Map<string, number>();
  for (let from = 0; from < 100000; from += 1000) {
    let page: { from_slug: string; to_slug: string }[] = [];
    try {
      const res = await fetch(`${BASE}/rest/v1/role_links?select=from_slug,to_slug&order=from_slug.asc,score.desc`, {
        headers: { apikey: dataKey, Range: `${from}-${from + 999}` },
        cache: "no-store",
      });
      if (!res.ok) break;
      page = await res.json();
    } catch {
      break;
    }
    for (const l of page) {
      const n = seen.get(l.from_slug) ?? 0;
      if (n < perRole) out.push({ from: l.from_slug, to: l.to_slug });
      seen.set(l.from_slug, n + 1);
    }
    if (page.length < 1000) break;
  }
  return out;
}

// Skills in the job dictionary that have a Rolearch skill test (lib/skill-tests.ts).
export const TESTED: Record<string, string> = {
  Python: "Python", SQL: "SQL", Excel: "Excel", Statistics: "Statistics", AWS: "AWS", React: "React", Azure: "Microsoft Azure",
  "Machine learning": "Machine learning", "Project management": "Project management", "Clinical research": "Clinical research operations",
  "Google Cloud": "Google Cloud", Spark: "Apache Spark", "Power BI": "Power BI", Logistics: "Logistics & transportation", Kubernetes: "Kubernetes",
  "Inventory management": "Inventory management", Tableau: "Tableau", "Product management": "Product management", "Risk management": "Risk management",
  "Computer vision": "Computer vision", Cybersecurity: "Cybersecurity fundamentals", LLMs: "Generative AI & LLMs", Procurement: "Procurement & purchasing",
  "Accounts payable": "Accounts payable & receivable", "Accounts receivable": "Accounts payable & receivable", "Stakeholder management": "Stakeholder management",
  "Supply chain": "Supply chain planning", Docker: "Docker", "Technical writing": "Technical documentation", Recruiting: "Recruiting & talent acquisition",
};

export const roleName = async (slug: string) => (await roadmapEntry(slug))?.role ?? slug.replace(/-/g, " ");

/**
 * Routes from the member's current role to their goal, measured from live jobs: the direct move, the best bridge
 * role, and nearby roles. Falls back to the hand-written moves when either role isn't measured yet.
 */
export async function careerNetwork(currentTitle: string, target: string, skills: string[]): Promise<Route[]> {
  const fallback = () => transitionNetwork(currentTitle, target, skills);
  const [from, to] = await Promise.all([roadmapForTitle(currentTitle), roadmapForTitle(target)]);
  if (!from || !to || from.slug === to.slug) return fallback();
  const [out, back] = await Promise.all([linksFrom(from.slug), linksFrom(to.slug)]);
  if (out.length === 0) return fallback();

  const mine = skills.map((x) => x.toLowerCase());
  const has = (c: string) => mine.some((m) => m === c.toLowerCase() || m.includes(c.toLowerCase()) || c.toLowerCase().includes(m));
  const route = (id: string, kind: Route["kind"], steps: string[], carries: string[], score: number): Route => {
    const have = carries.filter(has);
    return { id, kind, steps, carries, have, overlap: carries.length ? Math.round((have.length / carries.length) * 100) : 0, score: Math.round(score * 100) };
  };

  const direct = out.find((l) => l.to_slug === to.slug);
  const toTarget = new Map(back.map((l) => [l.to_slug, l]));
  // Best bridge: shares the most with both ends (the weaker of the two links), and beats going direct.
  const bridge = out
    .filter((l) => l.to_slug !== to.slug && toTarget.has(l.to_slug))
    .map((l) => ({ l, via: toTarget.get(l.to_slug)!, s: Math.min(l.score, toTarget.get(l.to_slug)!.score) }))
    .sort((a, b) => b.s - a.s)[0];

  const routes: Route[] = [];
  const fromName = currentTitle.trim();
  const toName = target.trim();
  if (bridge && bridge.s > (direct?.score ?? 0)) {
    routes.push(route("bridge", "bridge", [fromName, await roleName(bridge.l.to_slug), toName], bridge.l.shared, bridge.s));
  }
  routes.push(route("direct", "direct", [fromName, toName], direct?.shared ?? [], direct?.score ?? 0));
  const used = new Set([to.slug, bridge?.l.to_slug]);
  for (const l of out) {
    if (routes.length >= 5) break;
    if (used.has(l.to_slug)) continue;
    used.add(l.to_slug);
    routes.push(route(`nearby-${routes.length}`, "nearby", [fromName, await roleName(l.to_slug)], l.shared, l.score));
  }
  return routes;
}
