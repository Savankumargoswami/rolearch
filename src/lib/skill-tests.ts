import "server-only";
import { createHmac } from "node:crypto";

export const SKILLS = [
  { id: "python", name: "Python" },
  { id: "sql", name: "SQL" },
  { id: "excel", name: "Excel" },
  { id: "statistics", name: "Statistics" },
  { id: "aws", name: "AWS" },
  { id: "react", name: "React" },
  { id: "business_strategy", name: "Business strategy" },
  { id: "azure", name: "Microsoft Azure" },
  { id: "machine_learning", name: "Machine learning" },
  { id: "project_management", name: "Project management" },
  { id: "business_analysis", name: "Business analysis & requirements" },
  { id: "investment_analysis", name: "Investment analysis & portfolio management" },
  { id: "clinical_research", name: "Clinical research operations (GCP)" },
  { id: "google_cloud", name: "Google Cloud" },
  { id: "apache_spark", name: "Apache Spark" },
  { id: "power_bi", name: "Power BI" },
  { id: "logistics", name: "Logistics & transportation" },
  { id: "kubernetes", name: "Kubernetes" },
  { id: "inventory_management", name: "Inventory management" },
  { id: "tableau", name: "Tableau" },
  { id: "product_management", name: "Product management" },
  { id: "risk_management", name: "Risk management" },
  { id: "account_management", name: "Account management & planning" },
  { id: "computer_vision", name: "Computer vision" },
  { id: "mathematical_modeling", name: "Mathematical modeling" },
  { id: "cybersecurity", name: "Cybersecurity fundamentals" },
  { id: "generative_ai", name: "Generative AI & LLMs" },
  { id: "procurement", name: "Procurement & purchasing" },
  { id: "hvac_design", name: "HVAC design" },
  { id: "accounts_payable_receivable", name: "Accounts payable & receivable" },
  { id: "stakeholder_management", name: "Stakeholder management" },
  { id: "supply_chain_planning", name: "Supply chain planning" },
  { id: "docker", name: "Docker" },
] as const;
export const LEVELS = [
  { id: "entry", name: "Entry" },
  { id: "mid", name: "Mid" },
  { id: "senior", name: "Senior" },
  { id: "very_senior", name: "Very senior" },
] as const;
export type SkillId = (typeof SKILLS)[number]["id"];
export type LevelId = (typeof LEVELS)[number]["id"];

export const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;
export const levelName = (id: string) => LEVELS.find((l) => l.id === id)?.name ?? id;
export const isSkill = (id: string): id is SkillId => SKILLS.some((s) => s.id === id);
export const isLevel = (id: string): id is LevelId => LEVELS.some((l) => l.id === id);

/** What the browser gets for one question: never the answer or the hidden tests. */
export type PublicQuestion = {
  kind: "output" | "mcq" | "numeric" | "code";
  lang: string;
  topic: string;
  text: string;
  options?: string[];
  starter?: string;
  minutes?: number;
  schema?: string;
  sample?: { cells: Record<string, string | number | boolean | null>; out_col: string; first_row: number };
};

export type QuestionResult = {
  points: number;
  max: number;
  correct: boolean;
  chosen?: string | null;
  answer?: string;
  why?: string;
  tests_passed?: number;
  tests_total?: number;
};

export type Attempt = {
  id: string;
  user_id: string;
  skill: string;
  level: string;
  attempt_no: number;
  status: "in_progress" | "graded" | "expired";
  started_at: string;
  deadline: string;
  submitted_at: string | null;
  score: number | null;
  passed: boolean | null;
  proctor: Record<string, number>;
};

/** What a company sees for a graded attempt (db/030 skill_attempt_review); candidates never get this. */
export type Review = { questions: PublicQuestion[]; results: QuestionResult[] | null };

// Questions and results aren't readable directly (db/030): the candidate gets questions only while the test runs, through
// my_skill_test_questions(), and a company gets the graded review through skill_attempt_review().
export const ATTEMPT_COLUMNS = "id,user_id,skill,level,attempt_no,status,started_at,deadline,submitted_at,score,passed,proctor";
export const RETRY_HOURS = 24;
export const PASS_MARK = 90;

/** When a retry opens after a graded attempt, as a short label, or null if it already has. */
export function retryLabel(submittedAt: string | null): string | null {
  if (!submittedAt) return null;
  const at = new Date(submittedAt).getTime() + RETRY_HOURS * 3600_000;
  return at > Date.now() ? new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
}

/** True once the test's time (plus 30 s of grace for the last autosave) has run out. */
export function deadlinePassed(deadline: string): boolean {
  return new Date(deadline).getTime() + 30_000 < Date.now();
}

type AssessReply = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; data?: Record<string, unknown> };

/** Calls the grading service, signing the request with ASSESS_SECRET (timestamp + body, HMAC-SHA256). */
export async function callAssess(path: "/start" | "/submit", payload: Record<string, string>): Promise<AssessReply> {
  const url = process.env.ASSESS_URL?.replace(/\/$/, "");
  const secret = process.env.ASSESS_SECRET;
  if (!url || !secret) return { ok: false, error: "unavailable" };
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  try {
    const res = await fetch(url + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Assess-Ts": ts, "X-Assess-Sig": sig },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { ok: true, data } : { ok: false, error: String(data.error ?? "failed"), data };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
