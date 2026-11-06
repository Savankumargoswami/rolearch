// The RoleArch Match Engine: a reasoned job-fit report instead of one keyword score.
// It scores six dimensions separately (technical skills, experience, industry, education, location and
// eligibility, resume presentation), says for each required skill whether the candidate has proven it in a role,
// verified it with a Rolearch skill test, only listed it, can transfer it from a related skill, or is missing it,
// and turns that into a verdict (strong / potential / stretch / poor) with the reasons and the next actions.
// Deterministic: it reuses the job's stored requirements and screening reading, so it costs no extra AI calls.
import type { AtsReport } from "./ats";
import { coreTitle } from "./ats";
import { totalMonths } from "./expertise";
import type { Education } from "./job-requirements";
import type { ProfileData } from "./profile-schema";
import type { Screening } from "./screening";
import { degreeLevel, mentions } from "./skills";

export type Tier = "verified" | "proven" | "listed" | "transferable" | "missing";
export type SkillFit = {
  name: string;
  group: "required" | "preferred" | "certification";
  tier: Tier;
  /** Where it shows: "Data Analyst at Acme", a project name, "Skills list", or the related skill for transferable ones. */
  where?: string;
  /** The line that proves it, when there is one. */
  quote?: string;
  /** For transferable skills: the related skill the candidate has. */
  via?: string;
  /** A Rolearch skill test that would verify it. */
  test?: { id: string; name: string };
};
export type DimensionId = "skills" | "experience" | "industry" | "education" | "location" | "presentation";
export type Dimension = { id: DimensionId; score: number; values: Record<string, string | number> };
export type Verdict = "strong" | "potential" | "stretch" | "poor";
export type FitReport = {
  score: number;
  verdict: Verdict;
  dimensions: Dimension[];
  skills: SkillFit[];
  /** Hard blockers from screening (missing required licence, degree, clearance, far short on years). */
  blockers: string[];
  /** Things only the candidate can confirm (relocation, citizenship, other screening questions). */
  confirm: string[];
};

export type FitJob = {
  title: string;
  description: string;
  required: string[];
  preferred: string[];
  certifications: string[];
  years: number;
  education: Education;
};
export type Badge = { skill: string; level: string };
type TestRef = { id: string; name: string };

const EDUCATION_LEVEL: Record<Education, number> = { none: 0, high_school: 0.5, associate: 1, bachelor: 2, master: 3, doctorate: 4 };
const WEIGHT: Record<DimensionId, number> = { skills: 40, experience: 25, industry: 10, education: 10, location: 10, presentation: 5 };

// Skills that stand in for each other: having one is real, transferable evidence for another in the same family.
const FAMILIES: string[][] = [
  ["Tableau", "Power BI", "Looker", "Qlik", "Looker Studio", "Superset", "Metabase"],
  ["SQL", "PostgreSQL", "MySQL", "SQL Server", "T-SQL", "Oracle", "Snowflake", "BigQuery", "Redshift", "SQLite"],
  ["AWS", "Azure", "Google Cloud", "GCP"],
  ["Python", "R", "Julia", "MATLAB", "SAS"],
  ["Java", "C#", "Kotlin", "Scala"],
  ["JavaScript", "TypeScript"],
  ["React", "Vue", "Angular", "Svelte"],
  ["Excel", "Google Sheets", "Spreadsheets"],
  ["Statistics", "Statistical analysis", "Regression", "Hypothesis testing", "A/B testing", "Experimentation"],
  ["Machine learning", "Predictive modeling", "scikit-learn", "Data science", "Forecasting"],
  ["Project management", "Agile", "Scrum", "Kanban", "Jira", "Program management"],
  ["Process improvement", "Lean", "Six Sigma", "Continuous improvement", "Kaizen", "Root cause analysis"],
  ["Supply chain", "Logistics", "Inventory management", "Demand planning", "Operations", "Procurement"],
  ["Salesforce", "HubSpot", "CRM", "Dynamics 365"],
  ["Docker", "Kubernetes", "Containers"],
  ["Terraform", "CloudFormation", "Infrastructure as code", "Pulumi"],
  ["ETL", "Data pipelines", "Airflow", "dbt", "Data engineering", "Spark"],
  ["Data visualization", "Dashboards", "Reporting", "Business intelligence"],
  ["SAP", "Oracle ERP", "NetSuite", "ERP"],
  ["Financial modeling", "Financial analysis", "Valuation", "FP&A", "Budgeting", "Forecasting"],
  ["Stakeholder management", "Client management", "Account management", "Relationship management"],
  ["Requirements gathering", "Business analysis", "User stories", "Process mapping"],
];

// Which Rolearch skill test verifies a requirement (the test's own name also matches).
const TEST_ALIASES: Record<string, RegExp> = {
  python: /\bpython\b|pandas|numpy/i,
  sql: /\bsql\b|postgres|mysql|t-sql/i,
  excel: /\bexcel\b|spreadsheet|vlookup|pivot table/i,
  statistics: /statistic|hypothesis test|regression|a\/b test/i,
  aws: /\baws\b|amazon web services/i,
  react: /\breact\b/i,
  azure: /\bazure\b/i,
  google_cloud: /google cloud|\bgcp\b/i,
  machine_learning: /machine learning|\bml\b|scikit|predictive model/i,
  project_management: /project management|\bpmp\b|scrum|agile/i,
  business_analysis: /business analy|requirements gathering|user stor/i,
  investment_analysis: /portfolio management|investment analy|valuation|equity research/i,
  clinical_research: /clinical research|clinical trial|\bgcp\b.*clinical/i,
  apache_spark: /\bspark\b|pyspark|databricks/i,
  power_bi: /power bi|\bdax\b/i,
  logistics: /logistics|transportation|freight/i,
  kubernetes: /kubernetes|\bk8s\b/i,
  inventory_management: /inventory/i,
  tableau: /tableau/i,
  product_management: /product management|product manager|roadmapping/i,
  risk_management: /risk management|risk assessment/i,
  account_management: /account management|key account/i,
  computer_vision: /computer vision|image processing|opencv/i,
  mathematical_modeling: /mathematical model|optimization model|operations research/i,
  cybersecurity: /cyber ?security|information security|infosec/i,
  generative_ai: /generative ai|\bllm|large language model|prompt engineering|\brag\b/i,
  procurement: /procurement|purchasing|sourcing/i,
  hvac_design: /\bhvac\b/i,
  accounts_payable_receivable: /accounts payable|accounts receivable|\bap\b\/\bar\b/i,
  stakeholder_management: /stakeholder/i,
  supply_chain_planning: /supply chain|s&op|\bmrp\b|demand planning/i,
  docker: /\bdocker\b|container/i,
  technical_documentation: /technical writing|documentation|technical writer/i,
  data_warehousing: /data warehous|snowflake|bigquery|redshift|dimensional model/i,
  pure_mathematics: /pure math|abstract algebra|real analysis/i,
  business_strategy: /business strategy|strategic planning|competitive analysis/i,
};

// Industries, recognised from a posting and from where someone has worked.
const INDUSTRIES: [string, RegExp][] = [
  ["Banking and financial services", /\b(bank|banking|financial services|fintech|lending|credit card|wealth management|payments|asset management|brokerage)\b/gi],
  ["Insurance", /\b(insurance|insurer|underwriting|claims)\b/gi],
  ["Healthcare", /\b(healthcare|health care|hospital|clinical|patient|medical)\b/gi],
  ["Pharma and life sciences", /\b(pharma|pharmaceutical|biotech|life sciences|drug development)\b/gi],
  ["Manufacturing", /\b(manufacturing|factory|plant floor|production line|automotive|assembly)\b/gi],
  ["Retail and e-commerce", /\b(retail|e-?commerce|merchandising|store operations|consumer goods|cpg)\b/gi],
  ["Logistics and supply chain", /\b(logistics|supply chain|warehouse|distribution center|freight|shipping)\b/gi],
  ["Software and technology", /\b(saas|software company|tech company|platform company|cloud provider)\b/gi],
  ["Government and public sector", /\b(government|public sector|federal agency|municipal|state agency)\b/gi],
  ["Energy and utilities", /\b(energy|utilities|oil and gas|renewable|power generation)\b/gi],
  ["Telecommunications", /\b(telecom|telecommunications|wireless carrier|network operator)\b/gi],
  ["Education", /\b(university|school district|edtech|higher education)\b/gi],
  ["Consulting", /\b(consulting firm|consultancy|advisory firm)\b/gi],
];

const STOP = new Set(["and", "the", "for", "with", "of", "in", "to", "a", "an", "or", "skills", "skill", "experience", "knowledge", "ability", "strong", "proficiency", "using", "tools"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length >= 2 && !STOP.has(w));

/** Whether a text shows a skill: the skill dictionaries' synonyms first, then every meaningful word of the phrase. */
function shows(name: string, text: string): boolean {
  if (!text) return false;
  if (mentions(name, text) > 0) return true;
  const need = words(name);
  if (!need.length) return false;
  const have = new Set(words(text));
  return need.every((w) => have.has(w) || [...have].some((t) => t.length > 4 && (t.startsWith(w) || w.startsWith(t))));
}

/** The first line of a text that shows a skill, trimmed for quoting. */
function quoteFor(name: string, lines: string[]): string | undefined {
  const line = lines.find((l) => shows(name, l));
  return line ? (line.length > 160 ? `${line.slice(0, 157)}…` : line) : undefined;
}

function testFor(name: string, tests: readonly TestRef[]): TestRef | undefined {
  const lower = name.toLowerCase();
  return tests.find((s) => s.name.toLowerCase() === lower || TEST_ALIASES[s.id]?.test(name));
}

function industryOf(text: string, min: number): string | null {
  let best: [string, number] | null = null;
  for (const [name, re] of INDUSTRIES) {
    const n = text.match(re)?.length ?? 0;
    if (n >= min && (!best || n > best[1])) best = [name, n];
  }
  return best?.[0] ?? null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Builds the fit report. tests: the Rolearch skill tests (id + name), passed in so this file stays free of
 * server-only imports. ats: the resume-scanner report when the check has one (for the presentation dimension).
 */
export function fitReport(
  job: FitJob,
  p: ProfileData,
  opts: { badges?: Badge[]; screening?: Screening | null; ats?: AtsReport | null; tests: readonly TestRef[] },
): FitReport {
  const r = p.resume;
  const badges = new Set((opts.badges ?? []).map((b) => b.skill));
  const dims: Dimension[] = [];

  // ---------- technical skills, with evidence ----------
  const roles = r.experience.map((e) => ({ label: [e.title, e.company].filter(Boolean).join(" at "), lines: [e.title, ...e.bullets, e.skills.join(", ")].filter(Boolean) }));
  const projects = r.projects.map((x) => ({ label: x.name, lines: [x.name, x.summary, x.skills.join(", ")].filter(Boolean) }));
  const listedText = [p.headline, r.skills.join(", "), ...r.certifications.map((c) => `${c.name} ${c.issuer}`), ...r.education.map((e) => `${e.degree} ${e.field}`)].join("\n");

  const evidence = (name: string): Pick<SkillFit, "tier" | "where" | "quote"> | null => {
    for (const role of roles) if (shows(name, role.lines.join("\n"))) return { tier: "proven", where: role.label, quote: quoteFor(name, role.lines.slice(1)) };
    for (const pr of projects) if (shows(name, pr.lines.join("\n"))) return { tier: "listed", where: pr.label, quote: quoteFor(name, pr.lines.slice(1)) };
    if (shows(name, listedText)) return { tier: "listed", where: "skills" };
    return null;
  };

  const seen = new Set<string>();
  const skills: SkillFit[] = [];
  const add = (name: string, group: SkillFit["group"]) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const test = testFor(name, opts.tests);
    const found = evidence(name);
    if (test && badges.has(test.id)) {
      skills.push({ name, group, tier: "verified", where: found?.where, quote: found?.quote, test });
      return;
    }
    if (found) {
      skills.push({ name, group, ...found, test });
      return;
    }
    // Transferable: a skill from the same family is proven or listed.
    const family = FAMILIES.find((f) => f.some((s) => s.toLowerCase() === key || shows(s, name)));
    for (const other of family ?? []) {
      if (other.toLowerCase() === key || shows(other, name)) continue;
      const via = evidence(other);
      if (via) {
        skills.push({ name, group, tier: "transferable", via: other, where: via.where, quote: via.quote, test });
        return;
      }
    }
    skills.push({ name, group, tier: "missing", test });
  };
  job.required.forEach((n) => add(n, "required"));
  job.certifications.forEach((n) => add(n, "certification"));
  job.preferred.forEach((n) => add(n, "preferred"));

  const credit: Record<Tier, number> = { verified: 1, proven: 1, listed: 0.6, transferable: 0.5, missing: 0 };
  const weightOf = (s: SkillFit) => (s.group === "preferred" ? 0.5 : 1);
  const totalW = skills.reduce((a, s) => a + weightOf(s), 0);
  const gotW = skills.reduce((a, s) => a + weightOf(s) * credit[s.tier], 0);
  const core = skills.filter((s) => s.group !== "preferred");
  if (skills.length) {
    dims.push({
      id: "skills",
      score: clamp((gotW / totalW) * 100),
      values: {
        strong: core.filter((s) => s.tier === "verified" || s.tier === "proven").length,
        partial: core.filter((s) => s.tier === "listed" || s.tier === "transferable").length,
        missing: core.filter((s) => s.tier === "missing").length,
        total: core.length,
      },
    });
  }

  // ---------- experience: years and how close past roles are to this one ----------
  const have = totalMonths(p) / 12;
  const need = job.years;
  const target = coreTitle(job.title);
  const titles = r.experience.map((e) => coreTitle(e.title));
  const targetWords = target.split(" ").filter((w) => w.length > 2);
  const relevance = !target
    ? 0.6
    : titles.some((x) => x === target || x.includes(target))
      ? 1
      : titles.some((x) => targetWords.some((w) => x.split(" ").includes(w)))
        ? 0.6
        : 0.3;
  const yearsShare = need > 0 ? Math.min(1, have / need) : 1;
  if (r.experience.length || need > 0) {
    dims.push({
      id: "experience",
      score: clamp(need > 0 ? 60 * yearsShare + 40 * relevance : 40 + 60 * relevance),
      values: { have: Math.floor(have), need, related: relevance >= 1 ? "same" : relevance >= 0.6 ? "related" : "different" },
    });
  }

  // ---------- industry ----------
  const jobIndustry = industryOf(`${job.title}\n${job.description}`, 2);
  if (jobIndustry) {
    const mine = r.experience.map((e) => [e.company, e.title, ...e.bullets].join(" ")).join("\n");
    const yours = industryOf(mine, 1);
    const same = yours === jobIndustry;
    dims.push({ id: "industry", score: same ? 100 : yours ? 40 : 30, values: { job: jobIndustry, yours: yours ?? "" } });
  }

  // ---------- education ----------
  const needEd = EDUCATION_LEVEL[job.education];
  const haveEd = Math.max(0, ...r.education.map((e) => degreeLevel(`${e.degree} ${e.field}`)));
  if (needEd > 0 || r.education.length) {
    const ok = haveEd >= needEd || (needEd <= 0.5 && r.education.length > 0);
    dims.push({ id: "education", score: ok ? 100 : haveEd >= needEd - 1 ? 55 : 20, values: { need: job.education, have: haveEd } });
  }

  // ---------- location and eligibility (from the screening reading) ----------
  const blockers: string[] = [];
  const confirm: string[] = [];
  const elig = (opts.screening?.items ?? []).filter((i) => i.id !== "years" && i.id !== "degree");
  for (const i of opts.screening?.items ?? []) {
    const label = String(i.values.name ?? i.values.where ?? i.values.text ?? i.id);
    if (i.status === "blocker") blockers.push(i.id === "years" ? `${i.values.need}+ years of experience` : i.id === "degree" ? "the required degree" : label);
    else if (i.status === "check" && i.id !== "years" && i.id !== "degree") confirm.push(i.id === "onsite" || i.id === "hybrid" ? `Working ${i.id === "hybrid" ? "hybrid" : "on site"} in ${label}` : i.id === "citizenship" ? "Citizenship requirement" : label);
  }
  if (opts.screening?.sponsorship === "not_offered") confirm.push("Work authorization without visa sponsorship");
  if (elig.length || opts.screening?.sponsorship === "not_offered") {
    const pts: number[] = elig.map((i) => (i.status === "pass" ? 1 : i.status === "check" ? 0.6 : 0));
    if (opts.screening?.sponsorship === "not_offered") pts.push(0.7);
    dims.push({ id: "location", score: clamp((pts.reduce((a, b) => a + b, 0) / pts.length) * 100), values: { blockers: elig.filter((i) => i.status === "blocker").length, checks: confirm.length } });
  }

  // ---------- resume presentation (from the scanner report, when there is one) ----------
  if (opts.ats) {
    const parts = opts.ats.parts.filter((x) => x.id === "searchability" || x.id === "recruiter" || x.id === "formatting");
    const max = parts.reduce((a, x) => a + x.max, 0);
    if (max) dims.push({ id: "presentation", score: clamp((parts.reduce((a, x) => a + x.points, 0) / max) * 100), values: { issues: parts.reduce((a, x) => a + x.issues, 0) } });
  }

  // ---------- overall and verdict ----------
  const wsum = dims.reduce((a, d) => a + WEIGHT[d.id], 0);
  const score = wsum ? clamp(dims.reduce((a, d) => a + d.score * WEIGHT[d.id], 0) / wsum) : 0;
  const coreMissing = core.filter((s) => s.tier === "missing").length;
  const coreShare = core.length ? core.filter((s) => s.tier !== "missing").length / core.length : 1;
  const verdict: Verdict =
    score < 40 || blockers.length >= 2 || coreShare < 0.3
      ? "poor"
      : score >= 75 && blockers.length === 0 && coreMissing === 0
        ? "strong"
        : score >= 55 && blockers.length <= 1
          ? "potential"
          : "stretch";

  return { score, verdict, dimensions: dims, skills, blockers, confirm };
}
