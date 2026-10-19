// A member's match with a job, from their real profile. Requirements come from the job's description
// (read once by Claude and stored; see job-requirements.ts) and fall back to the job's skill tags.
// Each one is "verified" when the member's experience shows it, "listed" when it's elsewhere on their
// profile (skills, projects, certifications), or "missing".
import { totalMonths } from "./expertise";
import type { JobRequirements } from "./job-requirements";
import type { Match, Requirement } from "./match";
import type { ProfileData } from "./profile-schema";
import { degreeLevel, jobKeywords, mentions } from "./skills";

const STOP = new Set(["and", "the", "for", "with", "of", "in", "to", "a", "an", "or", "skills", "skill", "experience", "knowledge", "ability", "strong", "excellent", "proficiency", "understanding", "working", "basic", "advanced", "background", "degree", "familiarity", "expertise", "related", "field", "relevant", "proven", "solid", "good", "demonstrated", "hands", "on"]);
const EDUCATION_LEVEL = { none: 0, high_school: 0.5, associate: 1, bachelor: 2, master: 3, doctorate: 4 } as const;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length >= 2 && !STOP.has(w));

/** Whether some text shows a requirement: dictionary synonyms first, then every meaningful word of the phrase. */
function shows(name: string, text: string, textWords: Set<string>): boolean {
  if (mentions(name, text) > 0) return true;
  const need = words(name);
  return need.length > 0 && need.every((w) => textWords.has(w) || [...textWords].some((t) => t.length > 4 && (t.startsWith(w) || w.startsWith(t))));
}

export function matchProfile(
  job: { title: string; skills: string[]; years: number; description: string },
  p: ProfileData,
  req: JobRequirements | null = null,
): Match {
  const roleText = p.resume.experience.map((e) => [e.title, ...e.bullets, e.skills.join(", ")].join("\n")).join("\n");
  const restText = [
    p.headline,
    p.resume.skills.join(", "),
    ...p.resume.projects.map((x) => `${x.name} ${x.summary} ${x.skills.join(", ")}`),
    ...p.resume.certifications.map((c) => `${c.name} ${c.issuer}`),
    ...p.resume.education.map((e) => `${e.degree} ${e.field}`),
  ].join("\n");
  const roleWords = new Set(words(roleText));
  const restWords = new Set(words(restText));
  const status = (name: string): Requirement["status"] => (shows(name, roleText, roleWords) ? "verified" : shows(name, restText, restWords) ? "listed" : "missing");

  const reqs: Requirement[] = [];
  const seen = new Set<string>();
  const add = (name: string, group: Requirement["group"]) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    reqs.push({ name, status: status(name), group });
  };

  if (req && req.required.length + req.preferred.length + req.certifications.length > 0) {
    req.required.forEach((n) => add(n, "required"));
    req.certifications.forEach((n) => add(n, "certification"));
    req.preferred.forEach((n) => add(n, "preferred"));
  } else {
    // No description to read: the job's tags, then the hard skills its text stresses.
    job.skills.forEach((n) => add(n, "required"));
    for (const k of jobKeywords(`${job.title}\n${job.description}`)) {
      if (reqs.length >= 10) break;
      if (k.kind === "hard" && k.count >= 2) add(k.name, "required");
    }
  }

  const years = req?.years || job.years;
  if (years > 0) reqs.push({ name: String(years), status: totalMonths(p) / 12 >= years ? "verified" : "missing", isYears: true, group: "experience" });
  if (req && req.education !== "none") {
    const have = Math.max(0, ...p.resume.education.map((e) => degreeLevel(`${e.degree} ${e.field}`)));
    const need = EDUCATION_LEVEL[req.education];
    reqs.push({ name: req.education, status: have >= need || (need <= 0.5 && p.resume.education.length > 0) ? "verified" : "missing", group: "education" });
  }

  if (reqs.length === 0) return { score: 0, verdict: "weak", reqs, missing: [] };
  const weight = (r: Requirement) => (r.group === "preferred" ? 0.5 : 1);
  const total = reqs.reduce((s, r) => s + weight(r), 0);
  const points = reqs.reduce((s, r) => s + weight(r) * (r.status === "verified" ? 1 : r.status === "listed" ? 0.6 : 0), 0);
  const score = Math.round((points / total) * 100);
  return {
    score,
    verdict: score >= 80 ? "strong" : score >= 55 ? "partial" : "weak",
    reqs,
    missing: reqs.filter((r) => r.status === "missing" && (r.group === "required" || r.group === "certification" || r.group === "preferred")).map((r) => r.name),
  };
}
