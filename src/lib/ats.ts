// ATS check: scores a resume against a job the way resume scanners do (Jobscan-style keyword
// match) and checks what parsers like Workday need to read it into the right fields.
// Deterministic: the same resume and job always give the same score, and every point is explained.
import { totalMonths } from "./expertise";
import type { ProfileData } from "./profile-schema";
import { degreeLevel, jobKeywords, mentions, requiredDegree, startsWithAction } from "./skills";

export type AtsPartId = "hard" | "title" | "experience" | "education" | "soft" | "parsing" | "impact";
export type AtsPart = { id: AtsPartId; points: number; max: number };
export type AtsCheck = { id: string; part: AtsPartId; ok: boolean; detail: string };
export type AtsKeyword = { name: string; kind: "hard" | "soft"; inJob: number; inResume: number };
export type AtsReport = { score: number; parts: AtsPart[]; keywords: AtsKeyword[]; checks: AtsCheck[]; requiredYears: number; resumeYears: number };

export type AtsJob = { title: string; description: string; skills: string[]; years: number };
export type AtsContact = { email: string; phone: string };

const yearsRe = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)\b(?:\s+of)?(?:\s+[\w-]+){0,4}\s+experience/i;

/** Everything a scanner would read from the resume, as one block of text. */
export function resumeText(p: ProfileData): string {
  const r = p.resume;
  return [
    p.full_name,
    p.headline,
    p.location,
    ...r.experience.flatMap((e) => [e.title, e.company, e.location, ...e.bullets, e.skills.join(", ")]),
    ...r.projects.flatMap((x) => [x.name, x.summary, x.skills.join(", ")]),
    ...r.certifications.map((c) => `${c.name} ${c.issuer}`),
    ...r.education.map((e) => `${e.degree} ${e.field} ${e.school}`),
    r.skills.join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

const coreTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .split(/\s[-–—|,]\s|,/)[0]
    .replace(/\b(senior|sr|junior|jr|staff|principal|lead|head of|associate|intern|internship|new grad|graduate|i{1,3}|iv|\d+)\b\.?/g, " ")
    .replace(/[^a-z0-9/+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function titleMatch(jobTitle: string, p: ProfileData): "exact" | "close" | "none" {
  const core = coreTitle(jobTitle);
  if (!core) return "exact";
  const titles = [p.headline, ...p.resume.experience.map((e) => e.title)].map((x) => x.toLowerCase());
  if (titles.some((x) => x.includes(core))) return "exact";
  const words = core.split(" ").filter((w) => w.length > 2);
  const best = Math.max(0, ...titles.map((x) => words.filter((w) => x.includes(w)).length / Math.max(1, words.length)));
  return best >= 0.6 ? "close" : "none";
}

/** Scores a resume (as profile data) against a job. */
export function scoreAts(job: AtsJob, p: ProfileData, contact: AtsContact): AtsReport {
  const jd = `${job.title}\n${job.description}`;
  const text = resumeText(p);
  const r = p.resume;
  const checks: AtsCheck[] = [];
  const parts: AtsPart[] = [];

  // 1. Hard skills (40): the job's keywords, weighted by how often the job mentions them.
  const found = jobKeywords(jd);
  for (const s of job.skills) if (!found.some((k) => k.name === s)) found.push({ name: s, count: 1, kind: "hard" });
  const hard = found.filter((k) => k.kind === "hard").slice(0, 25);
  const soft = found.filter((k) => k.kind === "soft").slice(0, 8);
  const keywords: AtsKeyword[] = [...hard, ...soft].map((k) => ({ name: k.name, kind: k.kind, inJob: k.count, inResume: mentions(k.name, text) }));
  const weight = (k: AtsKeyword) => Math.min(k.inJob, 3) + (job.skills.includes(k.name) ? 1 : 0);
  const hardK = keywords.filter((k) => k.kind === "hard");
  const hardTotal = hardK.reduce((s, k) => s + weight(k), 0);
  const hardHit = hardK.filter((k) => k.inResume > 0).reduce((s, k) => s + weight(k), 0);
  parts.push({ id: "hard", points: hardTotal ? (hardHit / hardTotal) * 40 : 40, max: 40 });

  // 2. Job title (10): scanners and recruiters search by title first.
  const tm = titleMatch(job.title, p);
  parts.push({ id: "title", points: tm === "exact" ? 10 : tm === "close" ? 6 : 0, max: 10 });
  checks.push({ id: "title", part: "title", ok: tm === "exact", detail: tm === "exact" ? "exact" : tm === "close" ? "close" : "missing" });

  // 3. Experience (15): years asked for vs years on the resume.
  const requiredYears = job.years || Number(yearsRe.exec(job.description)?.[1] ?? 0);
  const months = totalMonths(p);
  const resumeYears = Math.floor(months / 12);
  const expPoints = requiredYears ? Math.min(1, months / 12 / requiredYears) * 15 : 15;
  parts.push({ id: "experience", points: expPoints, max: 15 });
  checks.push({ id: "years", part: "experience", ok: !requiredYears || months / 12 >= requiredYears, detail: `${resumeYears}/${requiredYears}` });

  // 4. Education (5).
  const needDegree = requiredDegree(job.description);
  const haveDegree = Math.max(0, ...r.education.map((e) => degreeLevel(`${e.degree} ${e.field}`)));
  const eduOk = !needDegree || haveDegree >= needDegree;
  parts.push({ id: "education", points: eduOk ? 5 : haveDegree ? 2 : 0, max: 5 });
  checks.push({ id: "degree", part: "education", ok: eduOk, detail: String(needDegree) });

  // 5. Soft skills (5).
  const softK = keywords.filter((k) => k.kind === "soft");
  parts.push({ id: "soft", points: softK.length ? (softK.filter((k) => k.inResume > 0).length / softK.length) * 5 : 5, max: 5 });

  // 6. Parsing (15): what an ATS like Workday needs to fill its fields correctly.
  const bullets = r.experience.flatMap((e) => e.bullets);
  const datesOk = r.experience.length > 0 && r.experience.every((e) => /^\d{4}-\d{2}$/.test(e.start) && (e.current || /^\d{4}-\d{2}$/.test(e.end)));
  const parsing: [string, boolean, number][] = [
    ["name", Boolean(p.full_name.trim()), 2],
    ["email", /\S+@\S+\.\S+/.test(contact.email), 2],
    ["phone", /\d{3}.*\d{3}.*\d{3}/.test(contact.phone), 2],
    ["location", Boolean(p.location.trim()), 1],
    ["sectionExperience", r.experience.length > 0, 2],
    ["sectionEducation", r.education.length > 0, 1],
    ["sectionSkills", r.skills.length > 0, 2],
    ["dates", datesOk, 3],
  ];
  parts.push({ id: "parsing", points: parsing.reduce((s, [, ok, pts]) => s + (ok ? pts : 0), 0), max: 15 });
  for (const [id, ok] of parsing) checks.push({ id, part: "parsing", ok, detail: "" });

  // 7. Impact and readability (10): what a recruiter sees in the six-second scan.
  const words = text.split(/\s+/).filter(Boolean).length;
  const withNumbers = bullets.filter((b) => /\d/.test(b)).length;
  const withVerbs = bullets.filter(startsWithAction).length;
  const metricsOk = bullets.length > 0 && withNumbers / bullets.length >= 0.3;
  const verbsOk = bullets.length > 0 && withVerbs / bullets.length >= 0.6;
  const lengthOk = words >= 350 && words <= 1100;
  parts.push({ id: "impact", points: (metricsOk ? 4 : 0) + (verbsOk ? 3 : 0) + (lengthOk ? 3 : words >= 200 ? 1.5 : 0), max: 10 });
  checks.push({ id: "metrics", part: "impact", ok: metricsOk, detail: `${withNumbers}/${bullets.length}` });
  checks.push({ id: "verbs", part: "impact", ok: verbsOk, detail: `${withVerbs}/${bullets.length}` });
  checks.push({ id: "length", part: "impact", ok: lengthOk, detail: String(words) });

  const score = Math.round(parts.reduce((s, x) => s + x.points, 0));
  return { score: Math.max(0, Math.min(100, score)), parts: parts.map((x) => ({ ...x, points: Math.round(x.points * 10) / 10 })), keywords, checks, requiredYears, resumeYears };
}
