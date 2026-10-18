// A member's match with a job, from their real profile: which of the job's skills their experience
// shows (verified), which they list elsewhere (listed), and which are missing.
import type { ProfileData } from "./profile-schema";
import { totalMonths } from "./expertise";
import type { Match, Requirement } from "./match";
import { jobKeywords, mentions } from "./skills";

export function matchProfile(job: { title: string; skills: string[]; years: number; description: string }, p: ProfileData): Match {
  // The job's own skill list first, then the hard skills its description stresses most.
  const names = [...job.skills];
  for (const k of jobKeywords(`${job.title}\n${job.description}`)) {
    if (names.length >= 10) break;
    if (k.kind === "hard" && k.count >= 2 && !names.includes(k.name)) names.push(k.name);
  }

  const roleText = p.resume.experience.map((e) => [e.title, ...e.bullets, e.skills.join(", ")].join("\n")).join("\n");
  const restText = [p.headline, p.resume.skills.join(", "), ...p.resume.projects.map((x) => `${x.summary} ${x.skills.join(", ")}`), ...p.resume.certifications.map((c) => c.name)].join("\n");

  const reqs: Requirement[] = names.map((name) => ({
    name,
    status: mentions(name, roleText) > 0 ? "verified" : mentions(name, restText) > 0 ? "listed" : "missing",
  }));
  if (job.years > 0) {
    reqs.push({ name: String(job.years), status: totalMonths(p) / 12 >= job.years ? "verified" : "missing", isYears: true });
  }
  if (reqs.length === 0) return { score: 0, verdict: "weak", reqs, missing: [] };
  const points = reqs.reduce((s, r) => s + (r.status === "verified" ? 1 : r.status === "listed" ? 0.6 : 0), 0);
  const score = Math.round((points / reqs.length) * 100);
  return {
    score,
    verdict: score >= 80 ? "strong" : score >= 55 ? "partial" : "weak",
    reqs,
    missing: reqs.filter((r) => r.status === "missing" && !r.isYears).map((r) => r.name),
  };
}
