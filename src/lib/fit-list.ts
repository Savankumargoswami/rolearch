// Job-Fit Intelligence for lists: a quick verdict for every job on a page, so discovery can rank and classify jobs
// by actual fit (Strong / Potential / Stretch / Poor) and say why. Uses each job's stored requirements (one batched
// request, no AI calls); jobs whose posting hasn't been read yet fall back to their skill tags.
import "server-only";
import type { JobLite } from "@/data/types";
import { fitReport, type FitReport, type Verdict } from "./fit";
import { loadBadges, loadCorrections } from "./fit-data";
import { storedRequirements } from "./job-requirements";
import type { AccountProfile } from "./profile";
import { SKILLS } from "./skill-tests";
import { createClient } from "./supabase/server";

export type ListFit = {
  score: number;
  verdict: Verdict;
  /** Core requirements proven or verified, and in total. */
  strong: number;
  total: number;
  /** The most important missing requirement, if any. */
  missing: string | null;
  /** A transferable skill that carries over, if any ("Tableau via Power BI"). */
  transfer: string | null;
};

const hasProfile = (v: AccountProfile | null) => Boolean(v && v.profile.resume.experience.length + v.profile.resume.skills.length > 0);

/** The full fit report for each job (by id) for the signed-in member; empty without a member or a profile. */
export async function fitReportsFor(jobs: JobLite[], viewer: AccountProfile | null): Promise<Map<string, FitReport>> {
  const out = new Map<string, FitReport>();
  if (!viewer || !hasProfile(viewer) || !jobs.length) return out;
  const db = await createClient();
  const [reqs, badges, corrections] = await Promise.all([storedRequirements(jobs.map((j) => j.id)), loadBadges(db, viewer.id), loadCorrections(db, viewer.id)]);
  for (const job of jobs) {
    const req = reqs.get(job.id);
    const required = (req?.required.length ? req.required : job.skills).slice(0, 14);
    if (!required.length) continue;
    const f = fitReport(
      {
        title: job.title,
        description: `${job.title}\n${job.company}`,
        required,
        preferred: (req?.preferred ?? []).slice(0, 8),
        certifications: (req?.certifications ?? []).slice(0, 6),
        years: req?.years || job.years,
        education: req?.education ?? "none",
      },
      viewer.profile,
      { badges, corrections, tests: SKILLS, source: req?.required.length ? "stored" : "tags" },
    );
    out.set(job.id, f);
  }
  return out;
}

/** Fit for each job (by id) for the signed-in member; empty when there's no member or no profile yet. */
export async function fitsFor(jobs: JobLite[], viewer: AccountProfile | null): Promise<Map<string, ListFit>> {
  const out = new Map<string, ListFit>();
  for (const [id, f] of await fitReportsFor(jobs, viewer)) out.set(id, summarize(f));
  return out;
}

/** A full fit report reduced to what a job list shows. */
export function summarize(f: FitReport): ListFit {
  const core = f.skills.filter((s) => s.group !== "preferred");
  const transfer = f.skills.find((s) => s.tier === "transferable");
  return {
    score: f.score,
    verdict: f.verdict,
    strong: core.filter((s) => s.tier === "proven" || s.tier === "verified").length,
    total: core.length,
    missing: core.find((s) => s.tier === "missing")?.name ?? null,
    transfer: transfer ? `${transfer.name} via ${transfer.via}` : null,
  };
}
