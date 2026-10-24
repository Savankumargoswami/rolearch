// ATS check: a match report in the shape of Jobscan's, computed the way scanners compute it.
// Keywords are the posting's own hard and soft skills, matched by word stems with phrases kept whole; the rest
// is searchability (can an ATS find and file you), recruiter tips (what a person sees in six seconds) and
// formatting (what breaks parsers). Deterministic: the same resume and job always give the same report.
// Weights are calibrated against Jobscan reports for the same resume and job.
import type { SkillGroup } from "./ats-doc";
import type { DocxFacts } from "./docx-format";
import { totalMonths } from "./expertise";
import type { ProfileData } from "./profile-schema";
import { canonical, degreeLevel, isSoft, jobKeywords, requiredDegree, startsWithAction } from "./skills";
import { count, stemmed } from "./stem";

export type AtsPartId = "searchability" | "hard" | "soft" | "recruiter" | "formatting";
export type AtsPart = { id: AtsPartId; points: number; max: number; issues: number };
export type AtsCheck = { id: string; part: AtsPartId; ok: boolean; detail: string };
export type AtsKeyword = { name: string; kind: "hard" | "soft"; inJob: number; inResume: number };
export type AtsReport = {
  score: number;
  parts: AtsPart[];
  keywords: AtsKeyword[];
  checks: AtsCheck[];
  requiredYears: number;
  resumeYears: number;
  /** The employer's applicant tracking system, when known ("Workday", "iCIMS"). */
  system: string;
};

/** keywords: the posting's own hard/soft skills when we could read them; skills/preferred: fallbacks. */
export type AtsJob = {
  title: string;
  description: string;
  keywords?: { hard: string[]; soft: string[] } | null;
  skills: string[];
  preferred?: string[];
  years: number;
  system?: string;
};
/** The uploaded file, when there is one: its name, type and (for Word files) its layout. */
export type AtsFile = { name: string; kind: "pdf" | "docx"; facts: DocxFacts | null };
/** A profile, plus the resume-only parts when the scan has them (summary, grouped skills, other text). */
type Resume = ProfileData & { summary?: string; skill_groups?: SkillGroup[]; extra?: string; education_notes?: string[]; header_lines?: string[] };
export type AtsContact = { email: string; phone: string };

const WEIGHTS: Record<AtsPartId, number> = { hard: 72, soft: 8, searchability: 10, recruiter: 5, formatting: 5 };

// "3+ years of experience", "3-7+ years experience", "3–5 yrs of relevant experience": the minimum counts.
const yearsRe = /(\d{1,2})\s*\+?\s*(?:[-–—to]+\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b(?:\s+of)?(?:\s+[\w-]+){0,4}\s+experience/i;

/** Everything a scanner would read from the resume, as one block of text. Lists we derived (each role's skills,
 * and the flat skills list when the resume's own skill groups are there) are left out, so nothing counts twice. */
export function resumeText(p: Resume): string {
  const r = p.resume;
  const grouped = (p.skill_groups ?? []).length > 0;
  return [
    p.full_name,
    p.headline,
    p.location,
    ...(p.header_lines ?? []),
    p.summary,
    ...(p.skill_groups ?? []).map((g) => `${g.label}: ${g.items.join(", ")}`),
    ...r.experience.flatMap((e) => [e.title, e.company, e.location, ...e.bullets]),
    ...r.projects.flatMap((x) => [x.name, x.summary, x.skills.join(", ")]),
    ...r.certifications.map((c) => `${c.name} ${c.issuer}`),
    ...r.education.map((e) => `${e.degree} ${e.field} ${e.school}`),
    grouped ? "" : r.skills.join(", "),
    ...(p.education_notes ?? []),
    p.extra,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The job title without level words and suffixes: "Senior Data Engineer - Platform (Remote)" -> "data engineer". */
export const coreTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .split(/\s[-–—|,]\s|,|\s-(?=\w)|(?<=\w)-\s/)[0]
    .replace(/\b(senior|sr|junior|jr|staff|principal|lead|head of|associate|intern|internship|new grad|graduate|i{1,3}|iv|\d+)\b\.?/g, " ")
    .replace(/[^a-z0-9/+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Clichés and filler recruiters skim past (the "resume tone" check).
const CLICHES = [
  "hard worker", "hard-working", "hardworking", "team player", "go-getter", "self-starter", "results-driven", "results-oriented", "detail-oriented",
  "think outside the box", "synergy", "go-to person", "best of breed", "highly motivated",
  "responsible for", "duties included", "references available upon request", "seasoned professional", "ninja", "rockstar", "guru",
];

const STANDARD_FONTS = new Set([
  "arial", "calibri", "cambria", "garamond", "georgia", "helvetica", "times new roman", "verdana", "tahoma", "trebuchet ms",
  "book antiqua", "aptos", "palatino linotype", "segoe ui", "lato", "open sans", "roboto", "carlito",
]);

/** Scores a resume against a job. */
export function scoreAts(job: AtsJob, p: Resume, contact: AtsContact, file?: AtsFile): AtsReport {
  const jdText = `${job.title}\n${job.description}`;
  const jd = stemmed(jdText);
  const text = resumeText(p);
  const rs = stemmed(text);
  const r = p.resume;
  const checks: AtsCheck[] = [];
  const add = (part: AtsPartId, id: string, ok: boolean, detail = "") => checks.push({ id, part, ok, detail });

  // Keywords: the posting's own list when we have it, else the built-in dictionary plus its requirements.
  let hardNames: string[];
  let softNames: string[];
  if (job.keywords && job.keywords.hard.length) {
    hardNames = job.keywords.hard;
    softNames = job.keywords.soft;
  } else {
    const found = jobKeywords(jdText);
    const extra = [...job.skills, ...(job.preferred ?? [])].map(canonical);
    hardNames = [...found.filter((k) => k.kind === "hard").map((k) => k.name), ...extra.filter((s) => !isSoft(s))].slice(0, 30);
    softNames = [...found.filter((k) => k.kind === "soft").map((k) => k.name), ...extra.filter(isSoft)].slice(0, 10);
  }
  const seen = new Set<string>();
  const keywordList = (names: string[], kind: "hard" | "soft"): AtsKeyword[] =>
    names
      .map((name) => ({ name, kind, inJob: count(name, jd), inResume: count(name, rs), key: stemmed(name).words.join(" ") }))
      // A scanner can only list words the posting actually contains.
      .filter((k) => k.inJob > 0 && !seen.has(k.key) && seen.add(k.key))
      .map(({ name, kind, inJob, inResume }) => ({ name, kind, inJob, inResume }));
  const hard = keywordList(hardNames, "hard");
  const soft = keywordList(softNames, "soft");
  const share = (list: AtsKeyword[]) => (list.length ? list.filter((k) => k.inResume > 0).length / list.length : 1);

  // Searchability: can an ATS read your details and find you by title.
  add("searchability", "location", Boolean(p.location.trim()));
  add("searchability", "email", /\S+@\S+\.\S+/.test(contact.email));
  add("searchability", "phone", /\d{3}.*\d{3}.*\d{3}/.test(contact.phone));
  add("searchability", "sectionEducation", r.education.length > 0);
  add("searchability", "sectionExperience", r.experience.length > 0);
  const core = coreTitle(job.title);
  // Scanners look for the title where you name yourself: headline, summary and job titles.
  const named = stemmed([p.headline, p.summary ?? "", ...r.experience.map((e) => e.title)].join("\n"));
  add("searchability", "title", !core || count(core, named) > 0, core ? "missing" : "exact");
  const datesOk = r.experience.length > 0 && r.experience.every((e) => /^\d{4}-\d{2}$/.test(e.start) && (e.current || /^\d{4}-\d{2}$/.test(e.end)));
  add("searchability", "dates", datesOk);
  const needDegree = requiredDegree(job.description);
  const haveDegree = Math.max(0, ...r.education.map((e) => degreeLevel(`${e.degree} ${e.field}`)));
  add("searchability", "degree", !needDegree || haveDegree >= needDegree, String(needDegree));
  if (file) {
    add("searchability", "fileType", file.kind === "docx" || file.kind === "pdf", file.kind);
    add("searchability", "fileChars", !/[^\w\s.()-]/.test(file.name));
    add("searchability", "fileLength", file.name.length <= 60);
  }

  // Recruiter tips.
  const months = totalMonths(p);
  const resumeYears = Math.floor(months / 12);
  const requiredYears = job.years || Number(yearsRe.exec(job.description)?.[1] ?? 0);
  const bullets = [...r.experience.flatMap((e) => e.bullets), ...r.projects.map((x) => x.summary).filter(Boolean)];
  const measurable = [...bullets, p.summary ?? ""].filter((b) => /\d/.test(b.replace(/\b(19|20)\d{2}\b/g, ""))).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lower = text.toLowerCase();
  const cliches = CLICHES.filter((c) => lower.includes(c));
  add("recruiter", "summary", Boolean((p.summary ?? "").trim()));
  add("recruiter", "years", !requiredYears || months / 12 >= requiredYears, `${resumeYears}/${requiredYears}`);
  add("recruiter", "metrics", measurable >= 5, String(measurable));
  add("recruiter", "tone", cliches.length === 0, cliches.slice(0, 3).join(", "));
  add("recruiter", "web", p.links.some((l) => l.url.trim()));
  add("recruiter", "length", words <= 1000 && words >= 300, String(words));

  // Formatting.
  const long = bullets.filter((b) => b.split(/\s+/).length > 40).length;
  const verbs = r.experience.flatMap((e) => e.bullets);
  const withVerb = verbs.filter(startsWithAction).length;
  add("formatting", "paragraphs", long === 0, String(long));
  add("formatting", "verbs", !verbs.length || withVerb / verbs.length >= 0.6, `${withVerb}/${verbs.length}`);
  const f = file?.facts;
  if (f) {
    add("formatting", "images", f.images === 0 && f.textBoxes === 0);
    add("formatting", "tables", f.tables === 0);
    add("formatting", "columns", f.columns <= 1);
    add("formatting", "alignment", f.notLeftShare <= 0.3);
    add("formatting", "special", f.specialChars <= 10);
    add("formatting", "bold", f.boldShare <= 0.06, String(Math.round(f.boldShare * 100)));
    add("formatting", "colour", f.colourShare <= 0.05);
    add("formatting", "fonts", f.fonts.length <= 2, String(f.fonts.length));
    add("formatting", "standardFont", f.fonts.every((x) => STANDARD_FONTS.has(x.toLowerCase())), f.fonts.join(", "));
    add("formatting", "fontSize", f.avgFontPt >= 9.5 && f.avgFontPt <= 13, String(f.avgFontPt));
    add("formatting", "headerFooter", !f.headerFooterText);
    const m = f.margins;
    add("formatting", "margins", !m || (Math.abs(m.left - m.right) <= 144 && [m.top, m.bottom, m.left, m.right].every((v) => v >= 576 && v <= 1800)));
    const pg = f.page;
    add("formatting", "pageSize", !pg || [[12240, 15840], [11906, 16838]].some(([w, h]) => Math.abs(pg.width - w) < 60 && Math.abs(pg.height - h) < 60));
  }

  const partScore = (id: AtsPartId) => {
    if (id === "hard") return share(hard);
    if (id === "soft") return share(soft);
    const mine = checks.filter((c) => c.part === id);
    return mine.length ? mine.filter((c) => c.ok).length / mine.length : 1;
  };
  const issues = (id: AtsPartId) =>
    id === "hard" ? hard.filter((k) => !k.inResume).length : id === "soft" ? soft.filter((k) => !k.inResume).length : checks.filter((c) => c.part === id && !c.ok).length;
  const parts: AtsPart[] = (["searchability", "hard", "soft", "recruiter", "formatting"] as AtsPartId[]).map((id) => ({
    id,
    points: Math.round(partScore(id) * WEIGHTS[id] * 10) / 10,
    max: WEIGHTS[id],
    issues: issues(id),
  }));
  const score = Math.round(parts.reduce((s, x) => s + x.points, 0));
  return { score: Math.max(0, Math.min(100, score)), parts, keywords: [...hard, ...soft], checks, requiredYears, resumeYears, system: job.system ?? "" };
}
