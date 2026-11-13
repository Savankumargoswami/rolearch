// JobFit evaluation harness (blueprint 5.7): hand-labelled candidate/job cases with the expected status of each
// requirement and the expected category. Run with `npm run eval:jobfit`. Prints direct-match precision, transferable
// recall, status accuracy, category accuracy and the unsupported-evidence rate, and exits non-zero on a regression.
// It also compares every case's score with scripts/jobfit-baseline.json and fails when one moves by more than 3 points,
// so a change to the scoring can't quietly shift results. After reviewing an intended change, record the new scores
// with `npm run eval:jobfit -- --update-baseline`. CI runs this on every push that touches the scoring code.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FIT_VERSION, fitReport, type Tier, type Verdict } from "../src/lib/fit";
import { withDefaults } from "../src/lib/profile-schema";

type Case = {
  name: string;
  profile: { headline?: string; resume: Record<string, unknown> };
  job: { title: string; description: string; required: string[]; preferred?: string[]; certifications?: string[]; years?: number; education?: "none" | "bachelor" | "master" };
  badges?: string[];
  corrections?: Record<string, "lack" | "have" | "wrong">;
  expect: Record<string, Tier>;
  verdict: Verdict[];
  /** A note the candidate must see ("Check before applying"). */
  confirm?: RegExp;
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
  // QA round 2-4 cases (synthetic profiles; requirements as read from each job's description and stored).
  {
    name: "QA AI-003: mechanical graduate vs senior backend is a poor fit",
    profile: {
      headline: "Mechanical engineering graduate",
      resume: {
        experience: [],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Mechanical Engineering",
            start: "2022",
            end: "2026"
          }
        ],
        projects: [
          {
            name: "Bridge truss design",
            url: "",
            summary: "Designed a truss in SolidWorks and ran FEA.",
            skills: [
              "SolidWorks",
              "FEA"
            ]
          }
        ],
        certifications: [],
        skills: [
          "SolidWorks",
          "AutoCAD",
          "MATLAB"
        ]
      }
    },
    job: {
      title: "Senior Backend Engineer",
      description: "Senior Backend Engineer.\n\nRequirements:\n- 5+ years building production backend systems\n- Go or Java\n- Distributed systems, Kubernetes, PostgreSQL\n- On-call experience for high-traffic services\n- BS in Computer Science or equivalent\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "Go",
        "Java",
        "Distributed systems",
        "Kubernetes",
        "PostgreSQL",
        "On-call",
        "High-traffic services",
        "Production backend systems"
      ],
      years: 5,
      education: "bachelor"
    },
    expect: {
      Go: "missing",
      Kubernetes: "missing",
      PostgreSQL: "missing"
    },
    verdict: [
      "poor"
    ]
  },
  {
    name: "QA AI-005: missing mandatory CPA is a poor fit",
    profile: {
      headline: "Data Analyst",
      resume: {
        experience: [
          {
            title: "Data Analyst",
            company: "Northwind Retail",
            website: "",
            location: "Chicago, United States",
            start: "2025-09",
            end: "",
            current: true,
            bullets: [
              "Wrote SQL reports for merchandising",
              "Automated Excel workbooks"
            ],
            skills: [
              "SQL",
              "Excel"
            ]
          },
          {
            title: "Analytics Intern",
            company: "Contoso Bank",
            website: "",
            location: "Chicago, United States",
            start: "2025-01",
            end: "2025-05",
            current: false,
            bullets: [
              "Built Excel models"
            ],
            skills: [
              "Excel"
            ]
          }
        ],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Economics",
            start: "2021",
            end: "2025"
          }
        ],
        projects: [],
        certifications: [],
        skills: [
          "SQL",
          "Excel",
          "Communication"
        ]
      }
    },
    job: {
      title: "Staff Accountant (CPA required)",
      description: "Staff Accountant.\n\nMandatory requirements:\n- Active CPA license (required, no exceptions)\n- 2+ years of public accounting\n- US GAAP, month-end close, reconciliations\n- Excel\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "US GAAP",
        "Month-end close",
        "Reconciliations",
        "Excel",
        "Public accounting"
      ],
      certifications: [
        "CPA license"
      ],
      years: 2
    },
    expect: {
      Excel: "proven",
      "US GAAP": "missing",
      "CPA license": "missing"
    },
    verdict: [
      "poor"
    ]
  },
  {
    name: "QA AI-006: graduate capstone with repo counts as project evidence",
    profile: {
      headline: "Data science graduate",
      resume: {
        experience: [],
        education: [
          {
            school: "Lakeside University",
            degree: "MS",
            field: "Data Science",
            start: "2025",
            end: "2026"
          }
        ],
        projects: [
          {
            name: "Churn prediction model",
            url: "https://github.com/example/churn",
            summary: "Trained a scikit-learn gradient boosting model on telecom churn data; reproducible repo with report.",
            skills: [
              "Python",
              "pandas",
              "scikit-learn",
              "Git"
            ]
          }
        ],
        certifications: [],
        skills: [
          "Python",
          "pandas",
          "scikit-learn",
          "Statistics",
          "Git"
        ]
      }
    },
    job: {
      title: "Entry-Level Data Scientist",
      description: "Entry-Level Data Scientist.\n\nRequirements:\n- Python (pandas, scikit-learn)\n- Machine learning model building\n- Statistics\n- Git/GitHub\n- Degree in a quantitative field\n\nNew graduates welcome.\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "Python",
        "pandas",
        "scikit-learn",
        "Machine learning",
        "Statistics",
        "Git",
        "GitHub"
      ],
      education: "bachelor"
    },
    expect: {
      Python: "listed",
      "scikit-learn": "listed",
      "Machine learning": "listed",
      GitHub: "listed"
    },
    verdict: [
      "potential"
    ]
  },
  {
    name: "QA AI-008: PostgreSQL work proves SQL",
    profile: {
      headline: "Analyst",
      resume: {
        experience: [
          {
            title: "Reporting Analyst",
            company: "Tailspin",
            website: "",
            location: "Chicago, United States",
            start: "2023-02",
            end: "",
            current: true,
            bullets: [
              "Wrote PostgreSQL queries with window functions and CTEs for finance reporting",
              "Designed star-schema data models"
            ],
            skills: [
              "PostgreSQL",
              "Excel"
            ]
          }
        ],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Finance",
            start: "2018",
            end: "2022"
          }
        ],
        projects: [],
        certifications: [],
        skills: [
          "PostgreSQL",
          "Excel",
          "Data modelling"
        ]
      }
    },
    job: {
      title: "SQL Analyst",
      description: "SQL Analyst.\n\nRequirements:\n- Expert SQL (window functions, CTEs)\n- Data modelling\n- Excel\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "SQL",
        "Window functions",
        "CTEs",
        "Data modelling",
        "Excel"
      ]
    },
    expect: {
      SQL: "proven",
      "Window functions": "proven",
      CTEs: "proven",
      "Data modelling": "listed"
    },
    verdict: [
      "strong"
    ]
  },
  {
    name: "QA AI-021: 8 years vs junior role gets the level note",
    profile: {
      headline: "Senior Data Analyst",
      resume: {
        experience: [
          {
            title: "Senior Data Analyst",
            company: "Contoso",
            website: "",
            location: "Chicago, United States",
            start: "2018-01",
            end: "",
            current: true,
            bullets: [
              "Led analytics for pricing; SQL, Tableau, Excel"
            ],
            skills: [
              "SQL",
              "Tableau",
              "Excel"
            ]
          }
        ],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Mathematics",
            start: "2013",
            end: "2017"
          }
        ],
        projects: [],
        certifications: [],
        skills: [
          "SQL",
          "Excel",
          "Tableau",
          "Python"
        ]
      }
    },
    job: {
      title: "Junior Data Analyst",
      description: "We are hiring a Junior Data Analyst.\n\nRequirements:\n- 0-1 years of experience\n- Strong SQL\n- Advanced Excel\n- Tableau dashboards\n- Bachelor's or Master's in a quantitative field\n\nResponsibilities: build weekly KPI dashboards and answer ad-hoc questions from the sales team.\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "SQL",
        "Excel",
        "Tableau",
        "KPI dashboards",
        "Ad-hoc analysis"
      ],
      education: "bachelor"
    },
    expect: {
      SQL: "proven",
      Tableau: "proven"
    },
    verdict: [
      "potential"
    ],
    confirm: /junior role/i,
  },
  {
    name: "QA AI-024: bootcamp only vs mandatory degree is a stretch",
    profile: {
      headline: "Data analyst (bootcamp)",
      resume: {
        experience: [],
        education: [
          {
            school: "CodeCamp",
            degree: "Bootcamp certificate",
            field: "Data Analytics",
            start: "2025",
            end: "2025"
          }
        ],
        projects: [
          {
            name: "Airline delays dashboard",
            url: "",
            summary: "SQL + Tableau dashboard on 5M flights.",
            skills: [
              "SQL",
              "Tableau"
            ]
          },
          {
            name: "Budget model",
            url: "",
            summary: "Excel model with SQL extracts.",
            skills: [
              "Excel",
              "SQL"
            ]
          }
        ],
        certifications: [],
        skills: [
          "SQL",
          "Excel",
          "Tableau",
          "Python"
        ]
      }
    },
    job: {
      title: "Financial Analyst (degree required)",
      description: "Financial Analyst.\n\nMandatory: an accredited bachelor's degree in Finance, Accounting or Economics (required, no equivalent experience accepted).\n\nRequirements:\n- Excel financial modelling\n- SQL\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "Excel",
        "Financial modelling",
        "SQL"
      ],
      education: "bachelor"
    },
    expect: {
      SQL: "listed",
      "Financial modelling": "missing"
    },
    verdict: [
      "stretch"
    ]
  },
  {
    name: "QA AI-029: SQL in a project counts as listed evidence",
    profile: {
      headline: "Reporting specialist",
      resume: {
        experience: [
          {
            title: "Reporting Specialist",
            company: "Woodgrove",
            website: "",
            location: "Chicago, United States",
            start: "2022-01",
            end: "",
            current: true,
            bullets: [
              "Built Tableau dashboards from Excel extracts"
            ],
            skills: [
              "Tableau",
              "Excel"
            ]
          }
        ],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Business",
            start: "2017",
            end: "2021"
          }
        ],
        projects: [
          {
            name: "SQL reporting",
            url: "",
            summary: "Wrote SQL queries for monthly reports.",
            skills: [
              "SQL"
            ]
          }
        ],
        certifications: [],
        skills: [
          "Tableau",
          "Excel",
          "SQL"
        ]
      }
    },
    job: {
      title: "SQL Analyst",
      description: "SQL Analyst.\n\nRequirements:\n- Expert SQL (window functions, CTEs)\n- Data modelling\n- Excel\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "SQL",
        "Window functions",
        "CTEs",
        "Data modelling",
        "Excel"
      ]
    },
    expect: {
      SQL: "listed",
      Excel: "proven"
    },
    verdict: [
      "stretch"
    ]
  },
  {
    name: "QA AI-031: preferred skill can't stand in for a required one",
    profile: {
      headline: "Reporting specialist",
      resume: {
        experience: [
          {
            title: "Reporting Specialist",
            company: "Woodgrove",
            website: "",
            location: "Chicago, United States",
            start: "2022-01",
            end: "",
            current: true,
            bullets: [
              "Built Tableau dashboards from Excel extracts"
            ],
            skills: [
              "Tableau",
              "Excel"
            ]
          }
        ],
        education: [
          {
            school: "Lakeside University",
            degree: "BS",
            field: "Business",
            start: "2017",
            end: "2021"
          }
        ],
        projects: [],
        certifications: [],
        skills: [
          "Tableau",
          "Excel"
        ]
      }
    },
    job: {
      title: "Reporting Analyst",
      description: "Reporting Analyst.\n\nRequired:\n- SQL (must have)\n- Excel\n\nPreferred:\n- Tableau\n\nAbout us: QA Synthetic Co is a fictional company used for software testing. We offer health insurance and a hybrid office.",
      required: [
        "SQL",
        "Excel"
      ],
      preferred: [
        "Tableau"
      ]
    },
    expect: {
      SQL: "missing",
      Tableau: "proven"
    },
    verdict: [
      "insufficient"
    ]
  },
];

const scores: Record<string, number> = {};
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
    { title: c.job.title, description: c.job.description, required: c.job.required, preferred: c.job.preferred ?? [], certifications: c.job.certifications ?? [], years: c.job.years ?? 0, education: c.job.education ?? "none" },
    p,
    { badges: (c.badges ?? []).map((skill) => ({ skill, level: "entry" })), corrections: c.corrections, tests: TESTS, source: "stored", now: "2026-11-07T00:00:00Z" },
  );
  // The profile's own words, with lists also read the way the app shows them ("Python, pandas").
  const lists: string[] = [];
  JSON.stringify(p.resume, (_, v) => (Array.isArray(v) && v.every((x) => typeof x === "string") && lists.push(v.join(", ")), v));
  const text = [JSON.stringify(p.resume), ...lists].join("\n").toLowerCase();
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
      if (!text.includes(s.quote.replace(/…$/, "").toLowerCase().slice(0, 40))) {
        unsupported += 1;
        failures.push(`${c.name}: ${s.name} quotes text that isn't in the profile: ${JSON.stringify(s.quote)}`);
      }
    }
  }
  if (c.verdict.includes(fit.verdict)) verdictRight += 1;
  else failures.push(`${c.name}: category expected ${c.verdict.join("/")}, got ${fit.verdict} (${fit.score})`);
  if (c.confirm && !fit.confirm.some((x) => c.confirm!.test(x))) failures.push(`${c.name}: expected a note matching ${c.confirm}`);
  scores[c.name] = fit.score;
}

// Score drift against the reviewed baseline.
const baselinePath = fileURLToPath(new URL("./jobfit-baseline.json", import.meta.url));
const drift: string[] = [];
if (process.argv.includes("--update-baseline")) {
  writeFileSync(baselinePath, JSON.stringify({ version: FIT_VERSION, scores }, null, 2) + "\n");
  console.log(`Baseline updated (${Object.keys(scores).length} cases, ${FIT_VERSION}).`);
} else {
  let baseline: { version: string; scores: Record<string, number> } | null = null;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    drift.push("no baseline yet: run with --update-baseline after reviewing the results");
  }
  for (const [name, score] of Object.entries(scores)) {
    const was = baseline?.scores[name];
    if (baseline && was === undefined) drift.push(`${name}: new case, not in the baseline`);
    else if (was !== undefined && Math.abs(score - was) > 3) drift.push(`${name}: score ${was} -> ${score}`);
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
console.log(`JobFit evaluation · ${FIT_VERSION} · ${CASES.length} cases · ${statusTotal} labelled requirements`);
console.log(`  status accuracy          ${pct(statusRight, statusTotal)}`);
console.log(`  direct-match precision   ${pct(directCorrect, directPredicted)}`);
console.log(`  transferable recall      ${pct(transferFound, transferExpected)}`);
console.log(`  category accuracy        ${pct(verdictRight, CASES.length)}`);
console.log(`  unsupported-evidence     ${pct(unsupported, claims)} of ${claims} quoted claims`);
if (failures.length) {
  console.log("\nMismatches:");
  for (const f of failures) console.log("  - " + f);
}
if (drift.length) {
  console.log("\nScore changes over 3 points (review, then --update-baseline if intended):");
  for (const d of drift) console.log("  - " + d);
}
// Quality bar: no unsupported evidence, direct matches always right, at most one mismatch overall, and no unreviewed
// score drift.
if (unsupported > 0 || directCorrect !== directPredicted || failures.length > 1 || drift.length) process.exit(1);
