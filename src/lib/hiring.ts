// Direct hiring: jobs companies post on Rolearch, their applicants, the pipeline and the numbers behind it.
// Everything here reads with the signed-in member's own session, so row-level security decides what they see
// (db/014_hiring.sql): companies their own jobs and applicants, applicants their own applications.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;
export type Stage = (typeof STAGES)[number] | "withdrawn";
/** The forward path a hire travels; "rejected" and "withdrawn" leave it. */
export const FUNNEL = ["new", "screening", "interview", "offer", "hired"] as const;

export type Question = { q: string; kind: "yesno" | "text"; required: boolean };
export type Answer = { q: string; a: string };

export type PostedJob = {
  id: string;
  title: string;
  status: "open" | "closed";
  city: string;
  country: string;
  workplace: string;
  postedAt: string | null;
  closedAt: string | null;
  questions: Question[];
};

export type Snapshot = {
  name: string;
  email: string;
  headline: string;
  location: string;
  avatar: string;
  links: { label?: string; url: string }[];
  resume: unknown;
};

export type ApplicationRow = {
  id: string;
  jobId: string;
  applicantId: string;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
  matchScore: number | null;
  atsScore: number | null;
  match: { verdict?: string; missing?: string[] };
  snapshot: Snapshot;
  answers: Answer[];
  note: string;
};

export type EventRow = { id: number; kind: "applied" | "stage" | "note" | "message" | "withdrawn"; fromStage: string | null; toStage: string | null; body: string; createdAt: string; actorId: string | null };

const JOB_COLS = "id,title,status,city,country,workplace,posted_at,closed_at,questions";
const APP_COLS = "id,job_id,applicant_id,stage,created_at,updated_at,stage_changed_at,match_score,ats_score,match,snapshot,answers,note";

function toJob(r: Record<string, unknown>): PostedJob {
  return {
    id: String(r.id),
    title: String(r.title),
    status: r.status === "closed" ? "closed" : "open",
    city: String(r.city ?? ""),
    country: String(r.country ?? ""),
    workplace: String(r.workplace ?? ""),
    postedAt: (r.posted_at as string) ?? null,
    closedAt: (r.closed_at as string) ?? null,
    questions: Array.isArray(r.questions) ? (r.questions as Question[]) : [],
  };
}

function toApp(r: Record<string, unknown>): ApplicationRow {
  return {
    id: String(r.id),
    jobId: String(r.job_id),
    applicantId: String(r.applicant_id),
    stage: r.stage as Stage,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    stageChangedAt: String(r.stage_changed_at),
    matchScore: typeof r.match_score === "number" ? r.match_score : null,
    atsScore: typeof r.ats_score === "number" ? r.ats_score : null,
    match: (r.match as ApplicationRow["match"]) ?? {},
    snapshot: (r.snapshot as Snapshot) ?? { name: "", email: "", headline: "", location: "", avatar: "", links: [], resume: null },
    answers: Array.isArray(r.answers) ? (r.answers as Answer[]) : [],
    note: String(r.note ?? ""),
  };
}

export async function companyJobs(db: SupabaseClient, uid: string): Promise<PostedJob[]> {
  const { data } = await db.from("jobs").select(JOB_COLS).eq("posted_by", uid).order("posted_at", { ascending: false });
  return (data ?? []).map(toJob);
}

export async function companyJob(db: SupabaseClient, uid: string, id: string): Promise<PostedJob | null> {
  const { data } = await db.from("jobs").select(JOB_COLS).eq("id", id).eq("posted_by", uid).maybeSingle();
  return data ? toJob(data) : null;
}

export async function applicationsFor(db: SupabaseClient, uid: string, jobIds?: string[]): Promise<ApplicationRow[]> {
  let q = db.from("applications").select(APP_COLS).eq("company_id", uid);
  if (jobIds) q = q.in("job_id", jobIds.length ? jobIds : ["-"]);
  const { data } = await q.order("created_at", { ascending: false }).limit(2000);
  return (data ?? []).map(toApp);
}

export async function application(db: SupabaseClient, id: string): Promise<ApplicationRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("applications").select(APP_COLS).eq("id", id).maybeSingle();
  return data ? toApp(data) : null;
}

export async function events(db: SupabaseClient, appIds: string[]): Promise<Map<string, EventRow[]>> {
  const out = new Map<string, EventRow[]>();
  if (!appIds.length) return out;
  const { data } = await db
    .from("application_events")
    .select("id,application_id,kind,from_stage,to_stage,body,created_at,actor_id")
    .in("application_id", appIds)
    .order("created_at", { ascending: true })
    .limit(5000);
  for (const r of data ?? []) {
    const list = out.get(r.application_id) ?? [];
    list.push({ id: r.id, kind: r.kind, fromStage: r.from_stage, toStage: r.to_stage, body: r.body, createdAt: r.created_at, actorId: r.actor_id });
    out.set(r.application_id, list);
  }
  return out;
}

export async function viewsFor(db: SupabaseClient, jobIds: string[]): Promise<{ jobId: string; day: string; views: number }[]> {
  if (!jobIds.length) return [];
  const { data } = await db.from("job_views").select("job_id,day,views").in("job_id", jobIds).limit(5000);
  return (data ?? []).map((r) => ({ jobId: r.job_id, day: r.day, views: r.views }));
}

/** The member's own applications, newest first, with the job each one is for. */
export async function myApplications(db: SupabaseClient, uid: string) {
  const { data } = await db
    .from("applications")
    .select("id,job_id,stage,created_at,updated_at,match_score,jobs(title,company,status)")
    .eq("applicant_id", uid)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const job = (Array.isArray(r.jobs) ? r.jobs[0] : r.jobs) as { title: string; company: string; status: string } | null;
    return { id: r.id as string, jobId: r.job_id as string, stage: r.stage as Stage, createdAt: r.created_at as string, updatedAt: r.updated_at as string, matchScore: r.match_score as number | null, title: job?.title ?? "", company: job?.company ?? "", open: job?.status === "open" };
  });
}

// ---------- Analytics ----------

const DAY = 86_400_000;

export type JobStats = {
  views: number;
  applicants: number;
  applyRate: number | null; // applicants per 100 views
  byStage: Record<Stage, number>;
  /** How many applicants ever reached each step (from the history), for the funnel. */
  reached: Record<(typeof FUNNEL)[number], number>;
  byVerdict: { strong: number; partial: number; weak: number; unknown: number };
  medianDaysToFirstAction: number | null;
  medianDaysToHire: number | null;
  daily: { day: string; views: number; applicants: number }[]; // last 14 days
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

export function jobStats(apps: ApplicationRow[], views: { day: string; views: number }[], history: Map<string, EventRow[]>, now = Date.now()): JobStats {
  const byStage = Object.fromEntries([...STAGES, "withdrawn"].map((s) => [s, 0])) as Record<Stage, number>;
  const reached = Object.fromEntries(FUNNEL.map((s) => [s, 0])) as JobStats["reached"];
  const byVerdict = { strong: 0, partial: 0, weak: 0, unknown: 0 };
  const firstAction: number[] = [];
  const toHire: number[] = [];
  for (const a of apps) {
    byStage[a.stage] += 1;
    const v = a.match.verdict;
    if (v === "strong" || v === "partial" || v === "weak") byVerdict[v] += 1;
    else byVerdict.unknown += 1;
    const evs = history.get(a.id) ?? [];
    const steps = new Set<string>(["new", ...evs.map((e) => e.toStage ?? "")]);
    // Reaching a later step implies the earlier ones.
    const furthest = Math.max(...FUNNEL.map((s, i) => (steps.has(s) ? i : -1)));
    FUNNEL.forEach((s, i) => {
      if (i <= furthest) reached[s] += 1;
    });
    const applied = Date.parse(a.createdAt);
    const first = evs.find((e) => e.kind === "stage");
    if (first) firstAction.push((Date.parse(first.createdAt) - applied) / DAY);
    const hired = evs.find((e) => e.toStage === "hired");
    if (hired) toHire.push((Date.parse(hired.createdAt) - applied) / DAY);
  }
  const totalViews = views.reduce((s, v) => s + v.views, 0);
  const daily = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10);
    return {
      day,
      views: views.filter((v) => v.day === day).reduce((s, v) => s + v.views, 0),
      applicants: apps.filter((a) => a.createdAt.slice(0, 10) === day).length,
    };
  });
  return {
    views: totalViews,
    applicants: apps.length,
    applyRate: totalViews ? Math.round((apps.length / totalViews) * 1000) / 10 : null,
    byStage,
    reached,
    byVerdict,
    medianDaysToFirstAction: median(firstAction),
    medianDaysToHire: median(toHire),
    daily,
  };
}

/** Whole days since an ISO time (0 for unknown or future), for "posted 3 days ago" labels. */
export function daysSince(iso: string | null): number {
  return iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY)) : 0;
}

// ---------- Company dashboard ----------

export type JobLine = { views: number; applicants: number; strong: number; avgMatch: number | null; waiting: number };
export type Overview = {
  applicants: number;
  avgMatch: number | null;
  strong: number;
  medianFirstReply: number | null;
  interviews: number;
  offers: number;
  hired: number;
  funnel: { stage: (typeof FUNNEL)[number]; n: number }[];
  weekly: number[]; // applicants per week, oldest first, last 8 weeks
  waiting: ApplicationRow[]; // still "new" after 14+ days
  perJob: Map<string, JobLine>;
};

/** Strong match: 80% or more, the same line the design and the job pages use. */
export const STRONG = 80;
/** After this many days without a reply, an applicant counts as waiting. */
export const WAITING_DAYS = 14;

/** The company dashboard's numbers for applicants who applied in the last `days` days (per-job lines use everyone). */
export function overview(apps: ApplicationRow[], history: Map<string, EventRow[]>, views: { jobId: string; views: number }[], days: number, now = Date.now()): Overview {
  const since = now - days * DAY;
  const recent = apps.filter((a) => Date.parse(a.createdAt) >= since);
  const scores = recent.map((a) => a.matchScore).filter((n): n is number => typeof n === "number");
  const firstReply: number[] = [];
  const reached = Object.fromEntries(FUNNEL.map((s) => [s, 0])) as Record<(typeof FUNNEL)[number], number>;
  for (const a of recent) {
    const evs = history.get(a.id) ?? [];
    const first = evs.find((e) => e.kind === "stage" || e.kind === "message");
    if (first) firstReply.push((Date.parse(first.createdAt) - Date.parse(a.createdAt)) / DAY);
    const steps = new Set<string>(["new", a.stage, ...evs.map((e) => e.toStage ?? "")]);
    const furthest = Math.max(...FUNNEL.map((s, i) => (steps.has(s) ? i : -1)));
    FUNNEL.forEach((s, i) => {
      if (i <= furthest) reached[s] += 1;
    });
  }
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    return apps.filter((a) => {
      const t = Date.parse(a.createdAt);
      return t > end - 7 * DAY && t <= end;
    }).length;
  });
  const perJob = new Map<string, JobLine>();
  const line = (id: string) => perJob.get(id) ?? perJob.set(id, { views: 0, applicants: 0, strong: 0, avgMatch: null, waiting: 0 }).get(id)!;
  for (const v of views) line(v.jobId).views += v.views;
  const sums = new Map<string, { total: number; n: number }>();
  for (const a of apps) {
    const l = line(a.jobId);
    l.applicants += 1;
    if ((a.matchScore ?? 0) >= STRONG) l.strong += 1;
    if (a.stage === "new" && (now - Date.parse(a.createdAt)) / DAY >= WAITING_DAYS) l.waiting += 1;
    if (typeof a.matchScore === "number") {
      const s = sums.get(a.jobId) ?? { total: 0, n: 0 };
      s.total += a.matchScore;
      s.n += 1;
      sums.set(a.jobId, s);
    }
  }
  for (const [id, s] of sums) line(id).avgMatch = Math.round(s.total / s.n);
  return {
    applicants: recent.length,
    avgMatch: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
    strong: scores.filter((n) => n >= STRONG).length,
    medianFirstReply: median(firstReply),
    interviews: reached.interview,
    offers: reached.offer,
    hired: reached.hired,
    funnel: FUNNEL.map((stage) => ({ stage, n: reached[stage] })),
    weekly,
    waiting: apps.filter((a) => a.stage === "new" && (now - Date.parse(a.createdAt)) / DAY >= WAITING_DAYS),
    perJob,
  };
}
