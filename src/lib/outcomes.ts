// Application outcome intelligence: what actually happens to a member's applications. Responses, interviews and
// offers overall, and broken down by resume version, job category and hiring platform; the skills in jobs that led
// to interviews; and where applications stop. Computed from the member's own tracker only.
import "server-only";
import { systemFromUrl } from "./ats-system";
import { supabaseKey, supabaseUrl } from "./supabase/server";
import type { TrackedJob } from "./tracker";

export type Rate = { key: string; sent: number; responses: number; interviews: number };
export type Outcomes = {
  sent: number;
  responses: number;
  interviews: number;
  offers: number;
  byVersion: Rate[];
  byCategory: Rate[];
  byPlatform: Rate[];
  /** Skills that appear more in jobs that led to interviews than in the rest. */
  winningSkills: string[];
  /** Where applications stop: no response, rejected before an interview, rejected after one. */
  stops: { noResponse: number; beforeInterview: number; afterInterview: number };
};

type JobFacts = { category: string; skills: string[]; source: string };

async function facts(ids: string[]): Promise<Map<string, JobFacts>> {
  const out = new Map<string, JobFacts>();
  const list = [...new Set(ids)].filter((id) => /^[\w.:-]{1,100}$/.test(id)).slice(0, 300);
  if (!list.length || !supabaseUrl || !supabaseKey) return out;
  try {
    const inList = encodeURIComponent(list.map((id) => `"${id}"`).join(","));
    const res = await fetch(`${supabaseUrl}/rest/v1/jobs?select=id,category,skills,source&id=in.(${inList})`, { headers: { apikey: supabaseKey }, cache: "no-store" });
    if (!res.ok) return out;
    for (const r of (await res.json()) as { id: string; category: string | null; skills: string[] | null; source: string | null }[]) {
      out.set(r.id, { category: r.category ?? "other", skills: r.skills ?? [], source: r.source ?? "" });
    }
  } catch {}
  return out;
}

const sentOf = (j: TrackedJob) => Boolean(j.appliedAt) || ["applied", "interviewing", "offer", "rejected"].includes(j.status);
const interviewed = (j: TrackedJob) => j.status === "interviewing" || j.status === "offer" || Boolean(j.interviewAt) || j.rejectionReason === "after_interview";
/** Any sign the employer replied: an interview, an offer, a logged conversation, or a rejection that wasn't silence. */
const responded = (j: TrackedJob) => interviewed(j) || j.log.length > 0 || (j.status === "rejected" && j.rejectionReason !== "" && j.rejectionReason !== "no_response");

export async function outcomes(jobs: TrackedJob[], versionLabels: Map<string, string>, versionOf: Map<string, string>): Promise<Outcomes> {
  const sent = jobs.filter(sentOf);
  const info = await facts(sent.map((j) => j.jobId));

  const group = (keyOf: (j: TrackedJob) => string | null): Rate[] => {
    const m = new Map<string, Rate>();
    for (const j of sent) {
      const key = keyOf(j);
      if (!key) continue;
      const r = m.get(key) ?? { key, sent: 0, responses: 0, interviews: 0 };
      r.sent += 1;
      if (responded(j)) r.responses += 1;
      if (interviewed(j)) r.interviews += 1;
      m.set(key, r);
    }
    return [...m.values()].sort((a, b) => b.sent - a.sent).slice(0, 8);
  };
  const platform = (j: TrackedJob) => systemFromUrl(j.url) || (info.get(j.jobId)?.source && !/careers page|employer feed/i.test(info.get(j.jobId)!.source) ? info.get(j.jobId)!.source : null) || "Company site";

  // Skills over-represented in jobs that led to interviews (needs a few of each to mean anything).
  const won = sent.filter(interviewed);
  const lost = sent.filter((j) => !interviewed(j));
  const count = (list: TrackedJob[]) => {
    const c = new Map<string, number>();
    for (const j of list) for (const s of new Set(info.get(j.jobId)?.skills ?? [])) c.set(s, (c.get(s) ?? 0) + 1);
    return c;
  };
  let winningSkills: string[] = [];
  if (won.length >= 2 && lost.length >= 2) {
    const w = count(won);
    const l = count(lost);
    winningSkills = [...w]
      .map(([s, n]) => ({ s, lift: n / won.length - (l.get(s) ?? 0) / lost.length, n }))
      .filter((x) => x.n >= 2 && x.lift > 0.15)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 6)
      .map((x) => x.s);
  }

  return {
    sent: sent.length,
    responses: sent.filter(responded).length,
    interviews: won.length,
    offers: sent.filter((j) => j.status === "offer").length,
    byVersion: group((j) => {
      const v = versionOf.get(j.jobId);
      return v ? (versionLabels.get(v) ?? "Tailored version") : "Without a saved version";
    }),
    byCategory: group((j) => info.get(j.jobId)?.category ?? null),
    byPlatform: group(platform),
    winningSkills,
    stops: {
      noResponse: sent.filter((j) => !responded(j)).length,
      beforeInterview: sent.filter((j) => j.status === "rejected" && !interviewed(j) && responded(j)).length,
      afterInterview: sent.filter((j) => j.status === "rejected" && interviewed(j)).length,
    },
  };
}
