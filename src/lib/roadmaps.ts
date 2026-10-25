// Career roadmaps (db/027_roadmaps.sql): written from O*NET occupation data (CC BY 4.0, onetcenter.org), links checked.
// Members read a roadmap with their own session (row-level security); the role list and the title -> roadmap
// lookup are public.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient, supabaseKey, supabaseUrl } from "./supabase/server";

export type Resource = { title: string; url: string; provider: string; kind: string };
export type RoadmapSkill = {
  name: string;
  why: string;
  lesson?: string;
  subtopics?: string[];
  drill?: string[];
  practice?: string;
  ready_when?: string;
  pitfalls?: string[];
  check?: { q: string; a: string }[];
  resources: Resource[];
};
export type RoadmapStage = {
  level: string;
  goal: string;
  weeks: number;
  plan?: { weeks: string; focus: string }[];
  skills: RoadmapSkill[];
  project: { title: string; brief: string; steps?: string[]; done_when: string };
  evidence?: string[];
};
export type Roadmap = {
  role: string;
  occupation: string;
  summary: string;
  stages: RoadmapStage[];
  tools?: { name: string; use: string; free_option: string }[];
  ladder?: { title: string; years: string; moves_you_up: string }[];
  credentials: { name: string; issuer: string; when: string }[];
  interview: ({ question: string; strong_answer: string } | string)[];
  glossary?: { term: string; meaning: string }[];
  mistakes: string[];
};
export type RoadmapEntry = { slug: string; role: string; summary: string; depth: "short" | "deep" };

/** Every role with a roadmap, for the public index. */
export async function roadmapList(): Promise<RoadmapEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("roadmaps");
  if (!supabaseUrl || !supabaseKey) return [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/roadmap_list`, { method: "POST", headers: { apikey: supabaseKey, "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
    return res.ok ? ((await res.json()) as RoadmapEntry[]) : [];
  } catch {
    return [];
  }
}

/** A roadmap, for a signed-in member only (null for visitors, or if there's no such roadmap). */
export async function memberRoadmap(slug: string): Promise<Roadmap | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("roadmaps").select("data").eq("slug", slug).maybeSingle();
  return (data?.data as Roadmap | undefined) ?? null;
}

// Same clean-up as the title mapping: no seniority, shift or schedule words, no place or team after a dash.
const SENIORITY =
  /\b(senior|sr|junior|jr|staff|lead|principal|associate|entry[- ]level|intern(ship)?|i{1,3}|iv|v|\d+|part[- ]time|full[- ]time|ft|pt|prn|per diem|temporary|seasonal|remote|hybrid|onsite|on[- ]site|night|nights|days|weekend|weekends|shift|mid[- ]level|level)\b\.?/g;
export function normalTitle(title: string) {
  let t = title.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ");
  t = t.split(/\s[-–—|/,:]\s|\s[-–—|]|,|\s@\s|\sat\s/)[0];
  return t.replace(SENIORITY, " ").replace(/[^a-z&+# ]/g, " ").replace(/\s+/g, " ").trim();
}

/** The roadmap for a job title, if one is mapped ({slug, role}). */
export async function roadmapForTitle(title: string): Promise<{ slug: string; role: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("roadmaps");
  const key = normalTitle(title);
  if (!key || !supabaseUrl || !supabaseKey) return null;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/role_titles?select=slug&title=eq.${encodeURIComponent(key)}`, { headers: { apikey: supabaseKey }, cache: "no-store" });
    if (!res.ok) return null;
    const [row] = (await res.json()) as { slug: string }[];
    if (!row) return null;
    // The roadmap itself is members-only; its name comes from the public list.
    const entry = (await roadmapList()).find((r) => r.slug === row.slug);
    return entry ? { slug: entry.slug, role: entry.role } : null;
  } catch {
    return null;
  }
}
