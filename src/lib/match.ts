import type { JobLite } from "@/data/types";
import { sampleProfile } from "@/data/profile";

export type ReqStatus = "verified" | "listed" | "missing";
export type Requirement = { name: string; status: ReqStatus; isYears?: boolean; group?: "required" | "preferred" | "certification" | "experience" | "education" };
export type Verdict = "strong" | "partial" | "weak";

export type Match = { score: number; verdict: Verdict; reqs: Requirement[]; missing: string[] };

const verified = new Set(sampleProfile.verified);
const listed = new Set(sampleProfile.listed);

/** Verified = 1 point, listed but unverified = ½, missing = 0. Experience counts as one requirement. */
export function matchJob(job: Pick<JobLite, "skills" | "years">): Match {
  const reqs: Requirement[] = job.skills.map((name) => ({
    name,
    status: verified.has(name) ? "verified" : listed.has(name) ? "listed" : "missing",
  }));
  if (job.years > 0) {
    reqs.push({ name: String(job.years), status: sampleProfile.years >= job.years ? "verified" : "listed", isYears: true });
  }
  const points = reqs.reduce((s, r) => s + (r.status === "verified" ? 1 : r.status === "listed" ? 0.5 : 0), 0);
  const score = Math.round((points / reqs.length) * 100);
  const verdict: Verdict = score >= 80 ? "strong" : score >= 55 ? "partial" : "weak";
  return { score, verdict, reqs, missing: reqs.filter((r) => r.status === "missing").map((r) => r.name) };
}
