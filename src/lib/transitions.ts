// Transferable skill intelligence: common career moves across industries, with the bridge role that connects them
// ("Manufacturing engineer -> Operations analyst -> Data analyst") and what usually carries over. The member's own
// evidence for each carried-over skill comes from their fit, so the path shows exactly which experience supports it.

export type Transition = { from: string; bridge: string; to: string; carries: string[] };

// [current role pattern, target role pattern, bridge role, what carries over]
const MOVES: [RegExp, RegExp, string, string[]][] = [
  [/manufactur|process|production|quality|industrial/i, /data analyst|business analyst|analytics|bi\b|business intelligence/i, "Operations / process analyst", ["Process improvement", "Root cause analysis", "KPIs and reporting", "Excel", "Statistics"]],
  [/mechanical|manufactur|industrial|production/i, /supply chain|logistics|planning|procurement/i, "Production planning / materials analyst", ["Capacity planning", "Inventory", "Vendor management", "Excel"]],
  [/business analyst/i, /data scien|machine learning/i, "Data analyst", ["Requirements", "SQL", "Stakeholder management", "Statistics"]],
  [/operations manager|operations lead|plant manager|store manager/i, /business intelligence|bi\b|data analyst|analytics/i, "Operations analytics / reporting lead", ["KPIs and dashboards", "Process improvement", "Stakeholder management"]],
  [/qa|quality assurance|test engineer|tester/i, /data engineer/i, "Test automation / data quality engineer", ["Python", "SQL", "Automation", "Data validation"]],
  [/qa|quality assurance|test engineer|tester/i, /software engineer|developer/i, "Test automation engineer", ["Programming", "Git", "CI/CD"]],
  [/software engineer|developer|programmer/i, /machine learning|ml engineer|data scien|ai engineer/i, "ML / data platform engineer", ["Python", "APIs", "Cloud", "Data pipelines"]],
  [/accountant|accounting|bookkeep|auditor/i, /financial analyst|fp&a|finance/i, "Senior accountant / FP&A analyst", ["Excel", "Financial statements", "Budgeting"]],
  [/teacher|tutor|lecturer|instructor/i, /instructional design|learning|training|l&d/i, "Training coordinator", ["Curriculum design", "Presentation", "Assessment"]],
  [/sales|business development|account executive/i, /customer success|account manag|product manag/i, "Account manager", ["Client relationships", "Negotiation", "CRM"]],
  [/nurse|pharmacist|clinic|medical/i, /clinical research|clinical trial|healthcare data/i, "Clinical research coordinator", ["GCP basics", "Patient data", "Documentation"]],
  [/civil|structural|construction/i, /project manag|program manag/i, "Project engineer", ["Scheduling", "Budget control", "Stakeholder management"]],
  [/support|help ?desk|service desk/i, /system admin|devops|cloud|network/i, "Systems / IT operations engineer", ["Troubleshooting", "Linux", "Networking"]],
  [/data analyst|analyst/i, /data scien|machine learning/i, "Analytics engineer / junior data scientist", ["SQL", "Python", "Statistics", "Experimentation"]],
  [/marketing|content|social media/i, /product manag|growth|marketing analyt/i, "Growth / marketing analyst", ["Experimentation", "Analytics", "Customer insight"]],
];

/** The path from someone's current role to a target role, with a bridge role and what typically carries over. */
export function transitionPath(currentTitle: string, target: string): Transition | null {
  const from = currentTitle.trim();
  const to = target.trim();
  if (!from || !to) return null;
  // Same kind of role: no transition needed.
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  const shared = [...words(from)].filter((w) => words(to).has(w)).length;
  if (shared >= 2) return null;
  for (const [a, b, bridge, carries] of MOVES) if (a.test(from) && b.test(to)) return { from, bridge, to, carries };
  return { from, bridge: "", to, carries: [] };
}
