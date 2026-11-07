// JobFit evaluation harness (blueprint 5.7): hand-labelled candidate/job cases with the expected status of each
// requirement and the expected category. Run with `npm run eval:jobfit`. Prints direct-match precision, transferable
// recall, status accuracy, category accuracy and the unsupported-evidence rate, and exits non-zero on a regression.
import { fitReport, type Tier, type Verdict } from "../src/lib/fit";
import { withDefaults } from "../src/lib/profile-schema";

type Case = {
  name: string;
  profile: { headline?: string; resume: Record<string, unknown> };
  job: { title: string; description: string; required: string[]; preferred?: string[]; years?: number; education?: "none" | "bachelor" | "master" };
  badges?: string[];
  corrections?: Record<string, "lack" | "have" | "wrong">;
  expect: Record<string, Tier>;
  verdict: Verdict[];
};

const role = (title: string, company: string, start: string, bullets: string[], skills: string[] = [], current = false) => ({
  title, company, website: "", location: "", start, end: current ? "" : "2026-06", current, bullets, skills,
});
const TESTS = [{ id: "sql", name: "SQL" }, { id: "python", name: "Python" }, { id: "tableau", name: "Tableau" }, { id: "power_bi", name: "Power BI" }];

const CASES: Case[] = [
  {
    name: "Manufacturing engineer -> data analyst (bank)",
    profile: {
      headline: "Manufacturing engineer",
      resume: {
        experience: [role("Manufacturing Engineer", "Tata Motors", "2019-07", ["Built Power BI dashboards tracking OEE, cutting downtime 18%", "Automated weekly reports with Python scripts"], ["Power BI", "Python"], true)],
        education: [{ school: "Pune University", degree: "B.E.", field: "Mechanical", start: "2015", end: "2019" }],
        projects: [{ name: "Sales SQL analysis", url: "", summary: "Analysed sales data with SQL window functions", skills: ["SQL"] }],
        skills: ["Python", "SQL", "Power BI"],
      },
    },
    job: { title: "Data Analyst", description: "Consumer banking data analyst: SQL, Python and Tableau dashboards. Banking preferred.", required: ["SQL", "Python", "Tableau", "Stakeholder management"], preferred: ["Banking"], years: 3, education: "bachelor" },
    badges: ["sql"],
    expect: { SQL: "verified", Python: "proven", Tableau: "transferable", "Stakeholder management": "missing", Banking: "missing" },
    verdict: ["stretch", "potential"],
  },
  {
    name: "Same-role analyst: strong fit",
    profile: {
      resume: {
        experience: [role("Data Analyst", "Shopify", "2020-01", ["Wrote SQL queries for revenue reporting", "Built Tableau dashboards for 40 stakeholders", "Python notebooks for forecasting"], ["SQL", "Tableau", "Python"], true)],
        education: [{ school: "UofT", degree: "BSc", field: "Statistics", start: "2015", end: "2019" }],
        skills: ["SQL", "Tableau", "Python", "Excel"],
      },
    },
    job: { title: "Data Analyst", description: "Retail data analyst with SQL, Tableau, Python and Excel.", required: ["SQL", "Tableau", "Python", "Excel"], years: 3, education: "bachelor" },
    expect: { SQL: "proven", Tableau: "proven", Python: "proven", Excel: "listed" },
    verdict: ["strong", "potential"],
  },
  {
    name: "Confirmed gaps and a confirmed skill",
    profile: {
      resume: {
        experience: [role("Quality Engineer", "Bosch", "2018-03", ["Ran statistical process control on 3 lines", "Led root cause analysis for supplier defects"], ["SPC"], true)],
        skills: ["Minitab"],
      },
    },
    job: { title: "Data Engineer", description: "Build data pipelines with Python, Spark and Airflow.", required: ["Python", "Spark", "Airflow", "SQL"], years: 3 },
    corrections: { spark: "lack", airflow: "lack", python: "have" },
    expect: { Python: "listed", Spark: "gap", Airflow: "gap", SQL: "missing" },
    verdict: ["poor"],
  },
  {
    name: "Evidence marked wrong is not counted",
    profile: {
      resume: {
        experience: [role("Analyst", "Acme", "2021-01", ["Used Tableau for weekly reporting", "Managed SQL Server backups"], [], true)],
        skills: [],
      },
    },
    job: { title: "BI Analyst", description: "BI analyst with Tableau and SQL.", required: ["Tableau", "SQL", "Reporting"] },
    corrections: { tableau: "wrong" },
    expect: { Tableau: "missing", SQL: "proven", Reporting: "proven" },
    verdict: ["stretch", "potential", "poor"],
  },
  {
    name: "Too little information is not a low score",
    profile: { resume: { experience: [], skills: ["Python"] } },
    job: { title: "Software Engineer", description: "Python developer.", required: ["Python", "Django"] },
    expect: { Python: "listed", Django: "missing" },
    verdict: ["insufficient"],
  },
  {
    name: "Related tool is transferable, not a direct match",
    profile: {
      resume: {
        experience: [role("Cloud Engineer", "Infosys", "2019-01", ["Deployed services on Azure with Terraform", "Ran Kubernetes clusters for 30 microservices"], ["Azure", "Terraform", "Kubernetes"], true)],
        skills: ["Azure", "Terraform", "Kubernetes"],
      },
    },
    job: { title: "Cloud Engineer", description: "AWS cloud engineer with Terraform and Kubernetes.", required: ["AWS", "Terraform", "Kubernetes"], years: 3 },
    expect: { AWS: "transferable", Terraform: "proven", Kubernetes: "proven" },
    verdict: ["potential", "strong", "stretch"],
  },
];

let statusRight = 0;
let statusTotal = 0;
let directPredicted = 0;
let directCorrect = 0;
let transferExpected = 0;
let transferFound = 0;
let verdictRight = 0;
let unsupported = 0;
let claims = 0;
const failures: string[] = [];

for (const c of CASES) {
  const p = withDefaults({ ...c.profile, resume: { experience: [], education: [], projects: [], certifications: [], skills: [], ...c.profile.resume } } as Parameters<typeof withDefaults>[0]);
  const fit = fitReport(
    { title: c.job.title, description: c.job.description, required: c.job.required, preferred: c.job.preferred ?? [], certifications: [], years: c.job.years ?? 0, education: c.job.education ?? "none" },
    p,
    { badges: (c.badges ?? []).map((skill) => ({ skill, level: "entry" })), corrections: c.corrections, tests: TESTS, source: "stored", now: "2026-11-07T00:00:00Z" },
  );
  const text = JSON.stringify(p.resume).toLowerCase();
  for (const s of fit.skills) {
    const want = c.expect[s.name];
    if (!want) continue;
    statusTotal += 1;
    const direct = (t: Tier) => t === "verified" || t === "proven";
    if (direct(s.tier)) {
      directPredicted += 1;
      if (direct(want)) directCorrect += 1;
    }
    if (want === "transferable") {
      transferExpected += 1;
      if (s.tier === "transferable") transferFound += 1;
    }
    if (s.tier === want) statusRight += 1;
    else failures.push(`${c.name}: ${s.name} expected ${want}, got ${s.tier}`);
    // Integrity: every quoted piece of evidence must come from the candidate's own profile.
    if (s.quote) {
      claims += 1;
      if (!text.includes(s.quote.replace(/…$/, "").toLowerCase().slice(0, 40))) unsupported += 1;
    }
  }
  if (c.verdict.includes(fit.verdict)) verdictRight += 1;
  else failures.push(`${c.name}: category expected ${c.verdict.join("/")}, got ${fit.verdict} (${fit.score})`);
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
console.log(`JobFit evaluation · ${CASES.length} cases · ${statusTotal} labelled requirements`);
console.log(`  status accuracy          ${pct(statusRight, statusTotal)}`);
console.log(`  direct-match precision   ${pct(directCorrect, directPredicted)}`);
console.log(`  transferable recall      ${pct(transferFound, transferExpected)}`);
console.log(`  category accuracy        ${pct(verdictRight, CASES.length)}`);
console.log(`  unsupported-evidence     ${pct(unsupported, claims)} of ${claims} quoted claims`);
if (failures.length) {
  console.log("\nMismatches:");
  for (const f of failures) console.log("  - " + f);
}
// Quality bar: no unsupported evidence, direct matches always right, and at most one mismatch overall.
if (unsupported > 0 || directCorrect !== directPredicted || failures.length > 1) process.exit(1);
