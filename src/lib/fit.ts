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
import { degreeLevel, impliedIn, mentions } from "./skills";

/**
 * Requirement-level match status (blueprint 5.2): verified and proven are direct matches (a Rolearch skill badge, or
 * explicit evidence in a role), listed is a partial match (in a project or the skills list, depth unclear),
 * transferable is a closely related capability, missing means "not found in your current profile", and gap means the
 * candidate confirmed they don't have it.
 */
export type Tier = "verified" | "proven" | "listed" | "transferable" | "missing" | "gap";
export type Confidence = "high" | "medium" | "low";
export type Correction = "lack" | "have" | "wrong";
/** The scoring configuration version, shown with every analysis so results are reproducible. */
export const FIT_VERSION = "jobfit-1.2";
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
  /** How sure the match is, from the kind of evidence behind it. */
  confidence: Confidence;
  /** "must" for required skills and credentials, "preferred" for nice-to-haves. */
  importance: "must" | "preferred";
  /** The candidate's own correction, when they made one. */
  corrected?: Correction;
};
export type DimensionId = "skills" | "transferable" | "experience" | "industry" | "education" | "location" | "presentation";
export type Dimension = { id: DimensionId; score: number; values: Record<string, string | number> };
export type Verdict = "strong" | "potential" | "stretch" | "poor" | "insufficient";
export type FitReport = {
  score: number;
  verdict: Verdict;
  dimensions: Dimension[];
  skills: SkillFit[];
  /** Hard blockers from screening (missing required licence, degree, clearance, far short on years). */
  blockers: string[];
  /** Things only the candidate can confirm (relocation, citizenship, other screening questions). */
  confirm: string[];
  /** Share of core requirements with any evidence (0-100). */
  coverage: number;
  /** How complete the inputs were: a full profile and the posting's own requirements give high confidence. */
  confidence: Confidence;
  /** Why the inputs were incomplete, when confidence isn't high. */
  missingInfo: string[];
  version: string;
  analyzedAt: string;
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
// Blueprint 5.3 starting weights (a hypothesis to validate, not a predictor of hiring): experience 25, skills 30,
// transferable 20, industry 10, education 5, practical constraints 10. Resume presentation is shown, not scored.
const WEIGHT: Record<DimensionId, number> = { experience: 25, skills: 30, transferable: 20, industry: 10, education: 5, location: 10, presentation: 0 };

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

/** Whether a text shows a skill: the skill dictionaries' synonyms, specific skills that imply it (unless implied=false, used when
 * looking up skill families so the rule stays one-way), then every meaningful word of the phrase. */
function shows(name: string, text: string, implied = true): boolean {
  if (!text) return false;
  if (mentions(name, text) > 0 || (implied && impliedIn(name, text))) return true;
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

// ---------- eligibility read from the posting's own text (no AI call) ----------
const US_STATES: [string, string][] = [
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"],
  ["Delaware", "DE"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"],
  ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"],
  ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"],
  ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"],
  ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"],
  ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"],
  ["District of Columbia", "DC"],
];
// Large US cities, so "Denver, United States" can be placed in a state.
const US_CITIES: Record<string, string> = {
  "new york": "NY", brooklyn: "NY", "los angeles": "CA", "san francisco": "CA", "san jose": "CA", "san diego": "CA", oakland: "CA", sacramento: "CA",
  chicago: "IL", houston: "TX", dallas: "TX", austin: "TX", "san antonio": "TX", "fort worth": "TX", phoenix: "AZ", philadelphia: "PA",
  pittsburgh: "PA", denver: "CO", boulder: "CO", seattle: "WA", boston: "MA", atlanta: "GA", miami: "FL", orlando: "FL", tampa: "FL",
  portland: "OR", "las vegas": "NV", detroit: "MI", minneapolis: "MN", "salt lake city": "UT", nashville: "TN", charlotte: "NC", raleigh: "NC",
  columbus: "OH", cleveland: "OH", baltimore: "MD", "st. louis": "MO", "kansas city": "MO", indianapolis: "IN", milwaukee: "WI",
  "washington, dc": "DC", "washington dc": "DC",
};
const RESIDENCY = /\b(must|required to|need to|needs to|should)\s+(reside|live|be (?:located|based)|be a resident)\b|\b(only|cannot|can't|can not|unable to|not able to)\s+(?:currently\s+)?(hire|employ|consider|accept)\b|\bopen (?:only )?to (?:candidates|applicants|residents)\b|\bresidents of\b/i;
// Sponsorship is read per sentence and only in a work-permit sense (not event or export-licence sponsorship).
const VISA = /\b(visa|immigration|h-?1b|work (?:permit|authori[sz]ation)|authori[sz]ed to work|employment authori[sz]ation|sponsor(?:ship)? (?:for|of) (?:employment|work))\b/i;
const NO_SPONSOR = /\b(no|not|cannot|can't|unable to|will not|won't|do not|don't)\b[^.\n]{0,40}\bsponsor|\bwithout (?:the need for )?(?:visa )?sponsorship|authori[sz]ed to work[^.\n]{0,60}without restriction/i;
const MAYBE_SPONSOR = /\bsponsorship\b[^.\n]{0,40}\b(may|might|could|can)\b[^.\n]{0,20}\b(?:be )?(available|possible|considered|offered)|\bmay (?:be able to )?sponsor\b/i;
const CITIZEN = /\b(u\.?s\.? citizen(?:ship)?|must be a citizen|security clearance|active clearance)\b/i;

/** The US state a free-text location is in, when it can be told ("Austin, TX", "Denver, United States", "Ohio"). */
function stateOf(location: string): string | null {
  const l = location.toLowerCase();
  for (const [name, code] of US_STATES) if (new RegExp(`\\b${name.toLowerCase()}\\b`).test(l)) return code;
  const abbr = location.match(/,\s*([A-Z]{2})\b/);
  if (abbr && US_STATES.some(([, c]) => c === abbr[1])) return abbr[1];
  for (const [city, code] of Object.entries(US_CITIES)) if (new RegExp(`\\b${city.replace(".", "\\.")}\\b`).test(l)) return code;
  return null;
}

type TextEligibility = { blockers: string[]; confirm: string[]; checks: number[]; hard: boolean };

/**
 * Location and eligibility limits the posting states in plain words (where you must live, sponsorship, citizenship),
 * checked against the candidate's location. Used when there's no screening reading (the job page card), so a
 * state-restricted remote role can't show "Strong fit" without saying so. Pure and cheap: no AI call.
 */
export function textEligibility(description: string, location: string): TextEligibility {
  const out: TextEligibility = { blockers: [], confirm: [], checks: [], hard: false };
  const sentences = description.split(/(?<=[.!?])\s+|\n+/);
  const statesIn = (s: string) => US_STATES.filter(([name]) => new RegExp(`\\b${name}\\b`, "i").test(s)).map(([, code]) => code);
  const nameOf = (c: string) => US_STATES.find(([, code]) => code === c)![0];
  const listOf = (codes: string[], joiner: string) => {
    const names = codes.map(nameOf);
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} ${joiner} ${names[names.length - 1]}` : names[0];
  };
  const EXCLUDE = /\b(cannot|can't|can not|unable to|not able to|do not|don't|will not|won't)\s+(?:currently\s+)?(hire|employ|consider|accept)\b|\boutside (?:of )?(?:the following states|these states)?\s*:?\s*(?=[A-Z])/i;
  // A sentence naming cities ("based in Chicago or New York", "New York City", "Washington, DC") or a time zone is an
  // office-location note, not a list of states: the card already shows the job's location, so it's left alone.
  const cityNote = (s: string) =>
    /\b(city|cities|time ?zone|d\.?c\.?|london|toronto|dublin)\b/i.test(s) || Object.keys(US_CITIES).some((c) => c !== "new york" && new RegExp(`\\b${c.replace(".", "\\.")}\\b`, "i").test(s));
  const residency = sentences.filter((s) => RESIDENCY.test(s) && !cityNote(s));
  // "We cannot hire in Alaska or Hawaii" lists excluded states; "must reside in CA, NY or TX" lists the only allowed ones.
  const excluded = [...new Set(residency.filter((s) => EXCLUDE.test(s)).flatMap(statesIn))];
  const allowed = [...new Set(residency.filter((s) => !EXCLUDE.test(s)).flatMap(statesIn))].filter((c) => !excluded.includes(c));
  const mine = stateOf(location);
  if (allowed.length) {
    const list = listOf(allowed, "or");
    if (mine && allowed.includes(mine)) out.checks.push(1);
    else if (mine) {
      out.blockers.push(`Living in ${list} (the posting only hires there)`);
      out.checks.push(0);
    } else {
      out.confirm.push(`You live in ${list} (the posting only hires there)`);
      out.checks.push(0.6);
      out.hard = true;
    }
  } else if (excluded.length) {
    const list = listOf(excluded, "or");
    if (mine && excluded.includes(mine)) {
      out.blockers.push(`Not living in ${list} (the posting can't hire there)`);
      out.checks.push(0);
    } else if (!mine) {
      out.confirm.push(`You don't live in ${list} (the posting can't hire there)`);
      out.checks.push(0.6);
    } else out.checks.push(1);
  }
  const visaSentences = sentences.filter(
    (s) => VISA.test(s) || (/\bsponsor/i.test(s) && /\b(role|position|job|candidates?|applicants?)\b/i.test(s) && !/\b(event|export|licen[cs]e|deployment|change)\b/i.test(s)),
  );
  if (visaSentences.some((s) => NO_SPONSOR.test(s))) {
    out.confirm.push("Work authorization without visa sponsorship");
    out.checks.push(0.7);
  } else if (visaSentences.some((s) => MAYBE_SPONSOR.test(s))) {
    out.confirm.push("Visa sponsorship is only possible in some cases: confirm before relying on it");
    out.checks.push(0.6);
  }
  if (sentences.some((s) => CITIZEN.test(s) && /\b(requir|must|active)/i.test(s) && !/\b(not required|a plus|nice to have|preferred|willingness)\b/i.test(s))) {
    out.confirm.push("Citizenship or security clearance requirement");
    out.checks.push(0.6);
  }
  return out;
}

/**
 * Builds the fit report. tests: the Rolearch skill tests (id + name), passed in so this file stays free of
 * server-only imports. ats: the resume-scanner report when the check has one (for the presentation dimension).
 */
export function fitReport(
  job: FitJob,
  p: ProfileData,
  opts: {
    badges?: Badge[];
    screening?: Screening | null;
    ats?: AtsReport | null;
    tests: readonly TestRef[];
    /** The candidate's corrections, keyed by lowercased skill name. */
    corrections?: Record<string, Correction>;
    /** "tags" when the job's own requirements haven't been read yet (lower confidence). */
    source?: "stored" | "tags";
    /** ISO time of the analysis (passed in so this stays pure). */
    now?: string;
  },
): FitReport {
  const r = p.resume;
  const badges = new Set((opts.badges ?? []).map((b) => b.skill));
  const dims: Dimension[] = [];

  // ---------- technical skills, with evidence ----------
  const roles = r.experience.map((e) => ({ label: [e.title, e.company].filter(Boolean).join(" at "), lines: [e.title, ...e.bullets, e.skills.join(", ")].filter(Boolean) }));
  // The project link counts as evidence too (a github.com repo shows GitHub).
  const projects = r.projects.map((x) => ({ label: x.name, lines: [x.name, x.summary, x.skills.join(", "), x.url].filter(Boolean) }));
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
    const importance: SkillFit["importance"] = group === "preferred" ? "preferred" : "must";
    const corrected = opts.corrections?.[key];
    const test = testFor(name, opts.tests);
    // "That evidence is wrong": ignore what we matched in the resume (a passed skill test still counts).
    const found = corrected === "wrong" ? null : evidence(name);
    if (test && badges.has(test.id)) {
      skills.push({ name, group, tier: "verified", where: found?.where, quote: found?.quote, test, confidence: "high", importance, corrected });
      return;
    }
    // "I don't have this": a confirmed gap, not just missing evidence.
    if (corrected === "lack") {
      skills.push({ name, group, tier: "gap", test, confidence: "high", importance, corrected });
      return;
    }
    if (found) {
      const confidence: Confidence = found.tier === "proven" ? (found.quote ? "high" : "medium") : found.where === "skills" ? "low" : "medium";
      skills.push({ name, group, ...found, test, confidence, importance, corrected });
      return;
    }
    // "I do have this": a candidate-confirmed fact counts as partial evidence until a role or project shows it.
    if (corrected === "have") {
      skills.push({ name, group, tier: "listed", where: "confirmed", test, confidence: "medium", importance, corrected });
      return;
    }
    // Transferable: a skill from the same family is proven or listed.
    const family = FAMILIES.find((f) => f.some((s) => s.toLowerCase() === key || shows(s, name, false)));
    for (const other of family ?? []) {
      if (other.toLowerCase() === key || shows(other, name, false)) continue;
      const via = evidence(other);
      if (via) {
        skills.push({ name, group, tier: "transferable", via: other, where: via.where, quote: via.quote, test, confidence: "medium", importance, corrected });
        return;
      }
    }
    skills.push({ name, group, tier: "missing", test, confidence: "low", importance, corrected });
  };
  job.required.forEach((n) => add(n, "required"));
  job.certifications.forEach((n) => add(n, "certification"));
  job.preferred.forEach((n) => add(n, "preferred"));

  // Skills score only direct and partial evidence; transferable capability is scored on its own (below).
  const credit: Record<Tier, number> = { verified: 1, proven: 1, listed: 0.5, transferable: 0.3, missing: 0, gap: 0 };
  // A skill shown in a named project with a line that uses it is concrete evidence (graduates, career changers):
  // more than a bare skills-list entry, less than use in a paid role.
  const projectNames = new Set(r.projects.map((x) => x.name));
  const creditOf = (s: SkillFit) => (s.tier === "listed" && s.quote && s.where && projectNames.has(s.where) ? 0.75 : credit[s.tier]);
  const weightOf = (s: SkillFit) => (s.group === "preferred" ? 0.5 : 1);
  const totalW = skills.reduce((a, s) => a + weightOf(s), 0);
  const gotW = skills.reduce((a, s) => a + weightOf(s) * creditOf(s), 0);
  const core = skills.filter((s) => s.group !== "preferred");
  if (skills.length) {
    dims.push({
      id: "skills",
      score: clamp((gotW / totalW) * 100),
      values: {
        strong: core.filter((s) => s.tier === "verified" || s.tier === "proven").length,
        partial: core.filter((s) => s.tier === "listed" || s.tier === "transferable").length,
        missing: core.filter((s) => s.tier === "missing" || s.tier === "gap").length,
        total: core.length,
      },
    });
  }
  // Transferable capabilities: of the core requirements without direct evidence, how many does related experience
  // reach? (All direct: nothing needs transferring, full marks.)
  const indirect = core.filter((s) => s.tier !== "verified" && s.tier !== "proven");
  if (core.length) {
    const reach = indirect.reduce((a, s) => a + (s.tier === "transferable" ? 1 : s.tier === "listed" ? 0.6 : 0), 0);
    dims.push({
      id: "transferable",
      score: indirect.length ? clamp((reach / indirect.length) * 100) : 100,
      values: { transferable: indirect.filter((s) => s.tier === "transferable").length, partial: indirect.filter((s) => s.tier === "listed").length, total: indirect.length },
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
  // Far short of the years the posting requires (under half of 2+ years): a blocker, so the verdict can't be "Strong".
  const farShortYears = need >= 2 && have < need * 0.5;
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
  if (farShortYears && !blockers.some((b) => /years of experience/.test(b))) blockers.push(`${need}+ years of experience`);
  // Much more experience than a junior role asks for: not a blocker, but worth addressing in the application.
  const juniorRole = /\b(junior|jr\.?|entry[- ]level|graduate|intern(ship)?|trainee|apprentice)\b/i.test(job.title) || (need > 0 && need <= 2);
  if (juniorRole && have >= Math.max(need, 1) + 6) {
    confirm.push(`This is a junior role and you have ${Math.floor(have)} years of experience: say why it's the right move, since employers may ask about level and pay`);
  }
  // No screening reading (the job page card): read the posting's own words for where you must live, sponsorship
  // and citizenship, so those limits show and count without an extra AI call.
  const text = opts.screening ? null : textEligibility(job.description, [p.location, r.experience.find((e) => e.current)?.location ?? ""].filter(Boolean).join(" · "));
  if (text) {
    blockers.push(...text.blockers);
    confirm.push(...text.confirm);
  }
  if (elig.length || opts.screening?.sponsorship === "not_offered" || text?.checks.length) {
    const pts: number[] = elig.map((i) => (i.status === "pass" ? 1 : i.status === "check" ? 0.6 : 0));
    if (opts.screening?.sponsorship === "not_offered") pts.push(0.7);
    if (text) pts.push(...text.checks);
    dims.push({
      id: "location",
      score: clamp((pts.reduce((a, b) => a + b, 0) / pts.length) * 100),
      values: { blockers: elig.filter((i) => i.status === "blocker").length + (text?.blockers.length ?? 0), checks: confirm.length },
    });
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
  const coreMissing = core.filter((s) => s.tier === "missing" || s.tier === "gap").length;
  const coreShare = core.length ? core.filter((s) => s.tier !== "missing" && s.tier !== "gap").length / core.length : 1;
  const confirmedGaps = core.filter((s) => s.tier === "gap").length;

  // Confidence in the inputs: too little to go on means "insufficient information", not a low score.
  const missingInfo: string[] = [];
  const bullets = r.experience.reduce((a, e) => a + e.bullets.length, 0);
  // Graduates and career changers often have no paid roles yet: projects and education are real evidence, so a
  // profile with them is judged (medium confidence), not sent to "insufficient information".
  const otherEvidence = r.projects.length > 0 || r.education.length > 0 || r.certifications.length > 0;
  if (core.length < 3) missingInfo.push("job_requirements");
  if (!r.experience.length) missingInfo.push(otherEvidence ? "experience_projects" : "experience");
  else if (bullets < 2) missingInfo.push("experience_details");
  if (opts.source === "tags") missingInfo.push("job_text");
  const confidence: Confidence = missingInfo.some((m) => m === "job_requirements" || m === "experience") ? "low" : missingInfo.length ? "medium" : "high";

  // Clearly unrelated (most must-haves missing, low score) is a poor fit even when the profile is thin.
  const clearlyPoor = core.length >= 3 && coreShare < 0.3 && score < 40;
  const verdict: Verdict =
    confidence === "low" && !clearlyPoor
      ? "insufficient"
      : score < 40 || blockers.length >= 2 || coreShare < 0.3 || confirmedGaps >= 3
        ? "poor"
        : score >= 75 && blockers.length === 0 && coreMissing === 0 && !text?.hard
          ? "strong"
          : score >= 55 && blockers.length <= 1 && !farShortYears
            ? "potential"
            : "stretch";

  return {
    score,
    verdict,
    dimensions: dims,
    skills,
    blockers,
    confirm,
    coverage: clamp(coreShare * 100),
    confidence,
    missingInfo,
    version: FIT_VERSION,
    analyzedAt: opts.now ?? "",
  };
}
