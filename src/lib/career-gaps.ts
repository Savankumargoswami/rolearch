// Career gap-to-action roadmap: for a target role, which skills employers ask for most, how far the member has each
// one (verified, proven, listed, transferable, missing), and for every gap a learning path, a practical project and
// the evidence to add once it's done. Aggregated from the member's fit against real open jobs for the role.
import "server-only";
import { searchJobs } from "@/data/db";
import type { JobLite } from "@/data/types";
import type { FitReport, Tier } from "./fit";
import { fitReportsFor } from "./fit-list";
import type { AccountProfile } from "./profile";

export type SkillGap = {
  name: string;
  /** Share of the role's jobs that ask for it (0-100). */
  demand: number;
  tier: Tier;
  /** How far along the member is (0-100), from the strongest evidence they have. */
  progress: number;
  via?: string;
  where?: string;
  /** The resume line that shows it, when there is one. */
  quote?: string;
  test?: { id: string; name: string };
};

export type Stage = "explore" | "learn" | "experience" | "land";

export type CareerGaps = {
  role: string;
  jobs: number;
  stage: Stage;
  skills: SkillGap[];
  best: { job: JobLite; fit: FitReport }[];
};

const PROGRESS: Record<Tier, number> = { verified: 100, proven: 85, listed: 50, transferable: 40, missing: 0 };
const RANK: Record<Tier, number> = { verified: 4, proven: 3, listed: 2, transferable: 1, missing: 0 };

export async function careerGaps(role: string, viewer: AccountProfile): Promise<CareerGaps> {
  const q = { q: role, cat: "all" as const, where: "anywhere" as const, remote: false, visa: false, pay: false, level: "any" as const, sort: "match" as const };
  const [a, b] = await Promise.all([searchJobs(q, 1, 40), searchJobs(q, 2, 40)]);
  const jobs = [...a.jobs, ...b.jobs.filter((j) => !a.jobs.some((x) => x.id === j.id))];
  const reports = await fitReportsFor(jobs, viewer);

  // Count each requirement across the role's jobs, keeping the member's best evidence for it.
  const bySkill = new Map<string, SkillGap & { n: number }>();
  for (const f of reports.values()) {
    for (const s of f.skills) {
      if (s.group === "preferred") continue;
      const key = s.name.trim().toLowerCase();
      const cur = bySkill.get(key);
      if (!cur) bySkill.set(key, { name: s.name, n: 1, demand: 0, tier: s.tier, progress: PROGRESS[s.tier], via: s.via, where: s.where, quote: s.quote, test: s.test });
      else {
        cur.n += 1;
        if (RANK[s.tier] > RANK[cur.tier]) Object.assign(cur, { tier: s.tier, progress: PROGRESS[s.tier], via: s.via, where: s.where, quote: s.quote });
        cur.test ??= s.test;
      }
    }
  }
  const total = Math.max(1, reports.size);
  const skills = [...bySkill.values()]
    .filter((s) => s.n >= Math.max(2, Math.round(total * 0.08)))
    .map(({ n, ...s }) => ({ ...s, demand: Math.round((n / total) * 100) }))
    .sort((x, y) => y.demand - x.demand)
    .slice(0, 16);

  const best = jobs
    .map((job) => ({ job, fit: reports.get(job.id) }))
    .filter((x): x is { job: JobLite; fit: FitReport } => Boolean(x.fit))
    .sort((x, y) => y.fit.score - x.fit.score)
    .slice(0, 3);

  // Where the member is on the path: still exploring, learning missing core skills, turning listed skills into
  // evidence, or ready to land the role.
  const top = skills.slice(0, 8);
  const missing = top.filter((s) => s.tier === "missing").length;
  const weak = top.filter((s) => s.tier === "listed" || s.tier === "transferable").length;
  const strongFits = [...reports.values()].filter((f) => f.verdict === "strong").length;
  const stage: Stage = !reports.size ? "explore" : strongFits >= 3 || (missing === 0 && weak <= 1) ? "land" : missing >= 2 ? "learn" : "experience";

  return { role, jobs: reports.size, stage, skills, best };
}
