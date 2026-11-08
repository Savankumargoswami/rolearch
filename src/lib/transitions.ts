// Transferable skill intelligence: common career moves across industries, with the bridge role that connects them
// ("Manufacturing engineer -> Operations analyst -> Data analyst") and what usually carries over. The member's own
// evidence for each carried-over skill comes from their fit, so the path shows exactly which experience supports it.

export type Transition = { from: string; bridge: string; to: string; carries: string[] };

// [current role pattern, target role pattern, bridge role, what carries over, a name for the target]
const MOVES: [RegExp, RegExp, string, string[], string][] = [
  [/manufactur|process|production|quality|industrial/i, /data analyst|business analyst|analytics|bi\b|business intelligence/i, "Operations / process analyst", ["Process improvement", "Root cause analysis", "KPIs and reporting", "Excel", "Statistics"], "Data analyst"],
  [/mechanical|manufactur|industrial|production/i, /supply chain|logistics|planning|procurement/i, "Production planning / materials analyst", ["Capacity planning", "Inventory", "Vendor management", "Excel"], "Supply chain analyst"],
  [/business analyst/i, /data scien|machine learning/i, "Data analyst", ["Requirements", "SQL", "Stakeholder management", "Statistics"], "Data scientist"],
  [/operations manager|operations lead|plant manager|store manager/i, /business intelligence|bi\b|data analyst|analytics/i, "Operations analytics / reporting lead", ["KPIs and dashboards", "Process improvement", "Stakeholder management"], "Business intelligence analyst"],
  [/qa|quality assurance|test engineer|tester/i, /data engineer/i, "Test automation / data quality engineer", ["Python", "SQL", "Automation", "Data validation"], "Data engineer"],
  [/qa|quality assurance|test engineer|tester/i, /software engineer|developer/i, "Test automation engineer", ["Programming", "Git", "CI/CD"], "Software engineer"],
  [/software engineer|developer|programmer/i, /machine learning|ml engineer|data scien|ai engineer/i, "ML / data platform engineer", ["Python", "APIs", "Cloud", "Data pipelines"], "Machine learning engineer"],
  [/accountant|accounting|bookkeep|auditor/i, /financial analyst|fp&a|finance/i, "Senior accountant / FP&A analyst", ["Excel", "Financial statements", "Budgeting"], "Financial analyst"],
  [/teacher|tutor|lecturer|instructor/i, /instructional design|learning|training|l&d/i, "Training coordinator", ["Curriculum design", "Presentation", "Assessment"], "Instructional designer"],
  [/sales|business development|account executive/i, /customer success|account manag|product manag/i, "Account manager", ["Client relationships", "Negotiation", "CRM"], "Customer success / product manager"],
  [/nurse|pharmacist|clinic|medical/i, /clinical research|clinical trial|healthcare data/i, "Clinical research coordinator", ["GCP basics", "Patient data", "Documentation"], "Clinical research associate"],
  [/civil|structural|construction/i, /project manag|program manag/i, "Project engineer", ["Scheduling", "Budget control", "Stakeholder management"], "Project manager"],
  [/support|help ?desk|service desk/i, /system admin|devops|cloud|network/i, "Systems / IT operations engineer", ["Troubleshooting", "Linux", "Networking"], "DevOps / cloud engineer"],
  [/data analyst|analyst/i, /data scien|machine learning/i, "Analytics engineer / junior data scientist", ["SQL", "Python", "Statistics", "Experimentation"], "Data scientist"],
  [/marketing|content|social media/i, /product manag|growth|marketing analyt/i, "Growth / marketing analyst", ["Experimentation", "Analytics", "Customer insight"], "Product / growth analyst"],
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

export type Route = {
  id: string;
  kind: "bridge" | "direct" | "nearby";
  steps: string[];
  carries: string[];
  have: string[];
  overlap: number;
  /** 0-100, measured from live jobs (lib/skill-graph.ts): how much the roles' skill demand overlaps. Absent for the hand-written moves. */
  score?: number;
};

/**
 * Career path network: the routes from the member's current role, for the explorer graph. The chosen goal via its
 * bridge role, the direct move, and nearby roles the same background commonly leads to. Overlap is the share of
 * what carries over that the member's own skills already show.
 */
export function transitionNetwork(currentTitle: string, target: string, skills: string[]): Route[] {
  const from = currentTitle.trim();
  const to = target.trim();
  if (!from || !to) return [];
  const mine = skills.map((x) => x.toLowerCase());
  const has = (c: string) => mine.some((m) => m.includes(c.toLowerCase()) || c.toLowerCase().includes(m));
  const route = (id: string, kind: Route["kind"], steps: string[], carries: string[]): Route => {
    const have = carries.filter(has);
    return { id, kind, steps, carries, have, overlap: carries.length ? Math.round((have.length / carries.length) * 100) : 0 };
  };
  const out: Route[] = [];
  const main = transitionPath(from, to);
  if (!main) return [];
  if (main.bridge) out.push(route("bridge", "bridge", [from, main.bridge, to], main.carries));
  out.push(route("direct", "direct", [from, to], main.carries));
  const seen = new Set([to.toLowerCase()]);
  for (const [a, b, bridge, carries, name] of MOVES) {
    if (out.length >= 4) break;
    if (!a.test(from) || b.test(to) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(route(`nearby-${out.length}`, "nearby", [from, bridge, name], carries));
  }
  return out;
}
