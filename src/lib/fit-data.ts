// Data the JobFit engine reads for a member: their corrections (confirmed gaps, confirmed skills, evidence marked
// wrong) and verified skill badges, plus saving each completed analysis with its scoring version. Every read fails
// soft, so a missing table (before a migration runs) never breaks a page.
import "server-only";
import type { createClient } from "./supabase/server";
import type { Badge, Correction, FitReport } from "./fit";

type Db = Awaited<ReturnType<typeof createClient>>;

export async function loadCorrections(db: Db, userId: string): Promise<Record<string, Correction>> {
  const { data, error } = await db.from("fit_corrections").select("skill_key,kind").eq("user_id", userId);
  if (error || !data) return {};
  return Object.fromEntries(data.map((r: { skill_key: string; kind: Correction }) => [r.skill_key, r.kind]));
}

export async function loadBadges(db: Db, userId: string): Promise<Badge[]> {
  const { data } = await db.from("skill_badges").select("skill,level").eq("user_id", userId);
  return (data ?? []) as Badge[];
}

/** Stores a completed analysis: score, category, scoring version and the requirement-level output, for history. */
export async function saveAnalysis(db: Db, userId: string, job: { key: string; title: string; company: string }, fit: FitReport): Promise<void> {
  const snapshot = {
    dimensions: fit.dimensions,
    skills: fit.skills.map(({ name, group, tier, confidence, importance, where, via, corrected }) => ({ name, group, tier, confidence, importance, where, via, corrected })),
    blockers: fit.blockers,
    confirm: fit.confirm,
    coverage: fit.coverage,
    confidence: fit.confidence,
    missingInfo: fit.missingInfo,
    analyzedAt: fit.analyzedAt,
  };
  await db.from("job_analyses").insert({
    user_id: userId,
    job_key: job.key.slice(0, 120),
    title: job.title.slice(0, 200),
    company: job.company.slice(0, 120),
    score: fit.score,
    verdict: fit.verdict,
    version: fit.version,
    snapshot,
  });
}
